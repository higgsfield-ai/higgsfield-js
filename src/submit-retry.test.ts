import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

import { HiggsfieldClient } from './client';
import { createHiggsfieldClient, reset } from './v2/client';

type Failure = { status: number } | { code: string };

// Every request fails the same way; returns the list of requests that reached the "network".
function failNetwork(failure: Failure) {
  const requests: InternalAxiosRequestConfig[] = [];
  const realCreate = axios.create.bind(axios);
  jest.spyOn(axios, 'create').mockImplementation((options) => {
    const client = realCreate(options);
    client.defaults.adapter = async (request) => {
      requests.push(request);
      if ('code' in failure) {
        throw new AxiosError('network failure', failure.code, request);
      }
      const response = {
        data: {},
        status: failure.status,
        statusText: String(failure.status),
        headers: new AxiosHeaders(),
        config: request,
      };
      throw new AxiosError('rejected', undefined, request, undefined, response);
    };
    return client;
  });
  return requests;
}

const noDelay = { retryBackoff: 0, retryMaxBackoff: 0 };
const posts = (requests: InternalAxiosRequestConfig[]) =>
  requests.filter((r) => r.method === 'post').length;

beforeEach(() => reset());
afterEach(() => {
  jest.restoreAllMocks();
  reset();
});

describe.each([
  [
    'v2 subscribe',
    (extra: object) =>
      createHiggsfieldClient({ credentials: 'k:s', ...noDelay, ...extra }).subscribe(
        '/some/model',
        {
          input: { prompt: 'a cat' },
          withPolling: false,
        }
      ),
  ],
  [
    'v1 generate',
    (extra: object) =>
      new HiggsfieldClient({ apiKey: 'k', apiSecret: 's', ...noDelay, ...extra }).generate(
        '/v1/text2image/soul',
        { prompt: 'a cat' },
        { withPolling: false }
      ),
  ],
])('%s', (_name, submit) => {
  it.each<[string, Failure]>([
    ['timeout', { code: 'ETIMEDOUT' }],
    ['connection reset', { code: 'ECONNRESET' }],
    ['HTTP 502', { status: 502 }],
    ['HTTP 503', { status: 503 }],
    ['HTTP 403 (not enough credits)', { status: 403 }],
    ['HTTP 422', { status: 422 }],
  ])('sends the job once after %s', async (_label, failure) => {
    const requests = failNetwork(failure);
    await expect(submit({})).rejects.toBeDefined();
    expect(posts(requests)).toBe(1);
  });

  it('retries when the connection was refused (request never sent)', async () => {
    const requests = failNetwork({ code: 'ECONNREFUSED' });
    await expect(submit({})).rejects.toBeDefined();
    expect(posts(requests)).toBe(4);
  });

  it('keeps the old behaviour with retrySubmissions: true', async () => {
    const requests = failNetwork({ status: 502 });
    await expect(submit({ retrySubmissions: true })).rejects.toBeDefined();
    expect(posts(requests)).toBe(4);
  });
});
