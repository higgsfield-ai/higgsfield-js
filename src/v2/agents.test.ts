import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

import { BrowserNotSupportedError, CredentialsMissedError, HiggsfieldError } from '../errors';
import { AgentAccessDeniedError, SessionBusyError } from '../agents/errors';
import { Media } from '../agents/resources';
import { config, createHiggsfieldClient, higgsfield } from './index';
import { reset } from './client';

function mockNetwork(status = 200) {
  const requests: InternalAxiosRequestConfig[] = [];
  const realCreate = axios.create.bind(axios);
  jest.spyOn(axios, 'create').mockImplementation((options) => {
    const client = realCreate(options);
    client.defaults.adapter = async (request) => {
      requests.push(request);
      const response = {
        data: { session_id: 's1', status: 'idle' },
        status,
        statusText: String(status),
        headers: new AxiosHeaders(),
        config: request,
      };
      if (status >= 400) {
        throw new AxiosError('rejected', undefined, request, undefined, response);
      }
      return response;
    };
    return client;
  });
  return requests;
}

beforeEach(() => reset());
afterEach(() => {
  jest.restoreAllMocks();
  reset();
});

test('V2 agent requests use Key auth, a dedicated host and preserve timeout/headers', async () => {
  const requests = mockNetwork();
  const client = createHiggsfieldClient({
    credentials: 'test:secret',
    baseURL: 'https://generation.test',
    agentBaseURL: 'https://agent.test',
    timeout: 4321,
    headers: { 'X-Example': 'preserved' },
  });
  await client.agents.sessions.create({ style: 'photo' });
  expect(requests).toHaveLength(1);
  expect(requests[0].baseURL).toBe('https://agent.test');
  expect(requests[0].url).toBe('/v1/agent/sessions');
  expect(requests[0].headers.get('Authorization')).toBe('Key test:secret');
  expect(requests[0].headers.get('hf-secret')).toBeUndefined();
  expect(requests[0].headers.get('User-Agent')).toBe('higgsfield-server-js/2.0');
  expect(requests[0].headers.get('X-Example')).toBe('preserved');
  expect(requests[0].timeout).toBe(4321);
  expect(JSON.parse(requests[0].data)).toEqual({ config: { style: 'photo' } });
});

test('explicit clients isolate account credentials from each other and the singleton', async () => {
  const requests = mockNetwork();
  const first = createHiggsfieldClient({ credentials: 'one:secret', baseURL: 'https://one.test' });
  const second = createHiggsfieldClient({ credentials: 'two:secret', baseURL: 'https://two.test' });
  config({ credentials: 'global:secret' });
  await first.agents.sessions.create();
  await second.agents.sessions.create();
  await higgsfield.agents.sessions.create();
  await first.subscribe('model', { input: {}, withPolling: false });
  await second.subscribe('model', { input: {}, withPolling: false });
  expect(requests.map((request) => request.headers.get('Authorization'))).toEqual([
    'Key one:secret',
    'Key two:secret',
    'Key global:secret',
    'Key one:secret',
    'Key two:secret',
  ]);
  expect(requests[3].baseURL).toBe('https://one.test');
  expect(requests[4].baseURL).toBe('https://two.test');
});

test('instance and global configure replace cached agent credentials', async () => {
  const requests = mockNetwork();
  const client = createHiggsfieldClient({ credentials: 'old:secret' });
  await client.agents.sessions.create();
  client.configure({ credentials: 'new:secret', agentBaseURL: 'https://new.test' });
  await client.agents.sessions.create();
  config({ credentials: 'global-old:secret' });
  await higgsfield.agents.sessions.create();
  config({ credentials: 'global-new:secret' });
  await higgsfield.agents.sessions.create();
  expect(requests.map((request) => request.headers.get('Authorization'))).toEqual([
    'Key old:secret',
    'Key new:secret',
    'Key global-old:secret',
    'Key global-new:secret',
  ]);
  expect(requests[1].baseURL).toBe('https://new.test');
});

test('lazy credentials preserve the configured agent host', async () => {
  const env = { ...process.env };
  try {
    for (const key of ['HF_KEY', 'HF_CREDENTIALS', 'HF_API_KEY', 'HF_API_SECRET'])
      delete process.env[key];
    const requests = mockNetwork();
    const client = createHiggsfieldClient({ agentBaseURL: 'https://lazy.test' });
    expect(() => client.agents).toThrow(CredentialsMissedError);
    process.env.HF_KEY = 'env:secret';
    await client.agents.sessions.create();
    expect(requests[0].headers.get('Authorization')).toBe('Key env:secret');
    expect(requests[0].baseURL).toBe('https://lazy.test');
  } finally {
    process.env = env;
  }
});

test('agent access rejects the browser even after initialization', () => {
  const client = createHiggsfieldClient({ credentials: 'test:secret' });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  try {
    expect(() => client.agents).toThrow(BrowserNotSupportedError);
    expect(() => higgsfield.agents).toThrow(BrowserNotSupportedError);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test.each([
  [403, AgentAccessDeniedError],
  [409, SessionBusyError],
] as const)(
  'agent HTTP %i is mapped without retrying a billable message',
  async (status, error) => {
    const requests = mockNetwork(status);
    const client = createHiggsfieldClient({ credentials: 'test:secret' });
    await expect(client.agents.sessions.send('s1', 'Hello')).rejects.toBeInstanceOf(error);
    expect(requests).toHaveLength(1);
  }
);

test.each(['uploaded', 'not_ready'])('media upload handles confirmation %s', async (status) => {
  const api = axios.create();
  const post = jest
    .spyOn(api, 'post')
    .mockResolvedValueOnce({
      data: {
        id: 'm1.jpeg',
        upload_url: 'https://storage.test/upload',
        content_type: 'image/jpeg',
        url: 'https://cdn.test/m1.jpeg',
      },
    })
    .mockResolvedValueOnce({ data: { status } });
  const put = jest.spyOn(axios, 'put').mockResolvedValue({ status: 200 });
  const result = new Media(api, 1234).upload(Buffer.from('image bytes'), 'jpeg');
  if (status === 'uploaded') await expect(result).resolves.toBe('https://cdn.test/m1.jpeg');
  else await expect(result).rejects.toBeInstanceOf(HiggsfieldError);
  expect(put).toHaveBeenCalledWith('https://storage.test/upload', Buffer.from('image bytes'), {
    headers: { 'Content-Type': 'image/jpeg' },
    maxBodyLength: Infinity,
    timeout: 1234,
  });
  expect(post).toHaveBeenLastCalledWith('/v1/agent/media/m1.jpeg/confirm', { type: 'image' });
});
