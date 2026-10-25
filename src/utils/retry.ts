import { AxiosError } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  backoff: number;
  maxBackoff: number;
  retryableErrors?: string[];
  /**
   * Set to false for requests that create a job (and charge credits).
   * Such requests are only resent when they certainly never reached the server.
   * Defaults to true.
   */
  idempotent?: boolean;
}

// The connection was never established, so the server cannot have seen the request.
const NOT_SENT_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED']);

function isRetryable(error: unknown, idempotent: boolean): boolean {
  if (!(error instanceof AxiosError)) {
    return idempotent;
  }
  if (error.code && NOT_SENT_CODES.has(error.code)) {
    return true;
  }
  if (!idempotent) {
    // Timeouts, resets and 5xx are ambiguous: the job may already exist.
    return false;
  }
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    (error.response !== undefined && error.response.status >= 500)
  );
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
  const idempotent = config.idempotent ?? true;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxRetries || !isRetryable(error, idempotent)) {
        throw lastError;
      }

      const delay = Math.min(
        config.backoff * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxBackoff
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry failed');
}
