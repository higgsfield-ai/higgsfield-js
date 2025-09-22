export interface ClientConfig {
  apiKey?: string;
  apiSecret?: string;
  timeout?: number;
  maxRetries?: number;
  retryBackoff?: number;
  retryMaxBackoff?: number;
  pollInterval?: number;
  maxPollTime?: number;
  headers?: Record<string, string>;
  baseURL?: string;
}

export class Config implements ClientConfig {
  apiKey?: string;
  apiSecret?: string;
  timeout: number = 120000; // ms
  maxRetries: number = 3;
  retryBackoff: number = 1000; // ms
  retryMaxBackoff: number = 60000; // ms
  pollInterval: number = 2000; // ms
  maxPollTime: number = 300000; // ms
  headers: Record<string, string> = {};
  baseURL: string = 'https://platform.higgsfield.ai';

  constructor(config?: Partial<ClientConfig>) {
    if (config) {
      Object.assign(this, config);
    }
    this.validate();
  }

  private validate(): void {
    if (this.timeout <= 0) {
      throw new Error('timeout must be positive');
    }
    if (this.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }
    if (this.maxRetries > 5) {
      throw new Error('maxRetries cannot be greater than 5');
    }
    if (this.pollInterval <= 0) {
      throw new Error('pollInterval must be positive');
    }
    if (this.maxPollTime <= 0) {
      throw new Error('maxPollTime must be positive');
    }
  }
}