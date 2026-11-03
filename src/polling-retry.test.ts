import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

import { HiggsfieldClient } from './client';
import { createHiggsfieldClient, reset } from './v2/client';

function serverFailure(request: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('temporary server failure', undefined, request, undefined, {
    config: request,
    data: {},
    headers: new AxiosHeaders(),
    status: 503,
    statusText: 'Service Unavailable',
  });
}

beforeEach(() => reset());
afterEach(() => {
  jest.restoreAllMocks();
  reset();
});

test('v2 polling continues after an interceptor-mapped server error', async () => {
  let statusCalls = 0;
  const realCreate = axios.create.bind(axios);
  jest.spyOn(axios, 'create').mockImplementation((options) => {
    const client = realCreate(options);
    client.defaults.adapter = async (request) => {
      if (request.method === 'post') {
        return {
          config: request,
          data: { request_id: 'request-1', status: 'queued' },
          headers: new AxiosHeaders(),
          status: 200,
          statusText: 'OK',
        };
      }
      statusCalls += 1;
      if (statusCalls === 1) throw serverFailure(request);
      return {
        config: request,
        data: { request_id: 'request-1', status: 'completed' },
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      };
    };
    return client;
  });

  const client = createHiggsfieldClient({
    credentials: 'test:secret',
    pollInterval: 1,
  });

  await expect(client.subscribe('/model', { input: {} })).resolves.toMatchObject({
    request_id: 'request-1',
    status: 'completed',
  });
  expect(statusCalls).toBe(2);
});

test('legacy polling continues after an interceptor-mapped server error', async () => {
  const realCreate = axios.create.bind(axios);
  jest.spyOn(axios, 'create').mockImplementation((options) => {
    const client = realCreate(options);
    client.defaults.adapter = async (request) => {
      if (request.method === 'post') {
        return {
          config: request,
          data: { id: 'set-1', jobs: [{ id: 'job-1', status: 'queued' }] },
          headers: new AxiosHeaders(),
          status: 200,
          statusText: 'OK',
        };
      }
      calls += 1;
      if (calls === 1) throw serverFailure(request);
      return {
        config: request,
        data: { jobs: [{ id: 'job-1', status: 'completed' }] },
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      };
    };
    return client;
  });

  let calls = 0;
  const client = new HiggsfieldClient({
    apiKey: 'test',
    apiSecret: 'secret',
    pollInterval: 1,
  });

  await expect(client.generate('/model', {}, { withPolling: true })).resolves.toMatchObject({
    id: 'set-1',
  });
  expect(calls).toBe(2);
});
