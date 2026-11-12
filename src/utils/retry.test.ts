import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { retryWithBackoff } from './retry';

const fast = { maxRetries: 3, backoff: 0, maxBackoff: 0 };

function networkError(code: string): AxiosError {
  return new AxiosError('network error', code);
}

function httpError(status: number): AxiosError {
  const response = {
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  } as AxiosResponse;
  return new AxiosError(`HTTP ${status}`, undefined, undefined, undefined, response);
}

function failingThenOk(error: unknown, failures = 1) {
  let calls = 0;
  const fn = jest.fn(async () => {
    calls += 1;
    if (calls <= failures) throw error;
    return 'ok';
  });
  return fn;
}

describe('retryWithBackoff', () => {
  describe('idempotent requests (default)', () => {
    it.each(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'])('retries on %s', async (code) => {
      const fn = failingThenOk(networkError(code));
      await expect(retryWithBackoff(fn, fast)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 5xx', async () => {
      const fn = failingThenOk(httpError(502));
      await expect(retryWithBackoff(fn, fast)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 4xx', async () => {
      const fn = failingThenOk(httpError(400));
      await expect(retryWithBackoff(fn, fast)).rejects.toBeInstanceOf(AxiosError);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('non-idempotent requests (job submission)', () => {
    const submit = { ...fast, idempotent: false };

    // The server may already have accepted and charged the job; a resend would create a second one.
    it.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'])(
      'does not resend after an ambiguous %s',
      async (code) => {
        const fn = failingThenOk(networkError(code));
        await expect(retryWithBackoff(fn, submit)).rejects.toBeInstanceOf(AxiosError);
        expect(fn).toHaveBeenCalledTimes(1);
      }
    );

    it.each([500, 502, 503, 504])('does not resend after HTTP %i', async (status) => {
      const fn = failingThenOk(httpError(status));
      await expect(retryWithBackoff(fn, submit)).rejects.toBeInstanceOf(AxiosError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not resend after a non-HTTP error', async () => {
      const fn = failingThenOk(new Error('boom'));
      await expect(retryWithBackoff(fn, submit)).rejects.toThrow('boom');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    // The request never reached the server, so resending cannot duplicate a job.
    it.each(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'])('still retries on %s', async (code) => {
      const fn = failingThenOk(networkError(code));
      await expect(retryWithBackoff(fn, submit)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
