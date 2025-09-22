export class HiggsfieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HiggsfieldError';
  }
}

export class AuthenticationError extends HiggsfieldError {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class CredentialsMissedError extends HiggsfieldError {
  constructor() {
    super('API credentials not found. Set HF_API_KEY and HF_API_SECRET environment variables or pass them in config.');
    this.name = 'CredentialsMissedError';
  }
}

export class APIError extends HiggsfieldError {
  statusCode?: number;
  responseData?: any;

  constructor(message: string, statusCode?: number, responseData?: any) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.responseData = responseData;
  }
}

export class TimeoutError extends HiggsfieldError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
