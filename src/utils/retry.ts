import { AxiosError } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  backoff: number;
  maxBackoff: number;
  retryableErrors?: string[];
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxRetries) {
        throw lastError;
      }

      // Check if error is retryable
      if (error instanceof AxiosError) {
        const isRetryable = 
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          (error.response && error.response.status >= 500);

        if (!isRetryable) {
          throw error;
        }
      }

      const delay = Math.min(
        config.backoff * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxBackoff
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry failed');
}