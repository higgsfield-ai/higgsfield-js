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
    super('API credentials not found. Set HF_CREDENTIALS (or HF_KEY) environment variable with format "KEY_ID:KEY_SECRET", or set HF_API_KEY and HF_API_SECRET environment variables, or pass them in config.');
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

export class NotEnoughCreditsError extends APIError {
  statusCode: number = 403

  constructor() {
    super('Not enough credits');
    this.name = 'AccountError';
  }
}

interface ValidationErrorDetail {
  type: string;
  loc: string[];
  msg: string;
  input?: any;
  ctx?: Record<string, any>;
}

export class ValidationError extends APIError {
  statusCode: number = 422
  details?: ValidationErrorDetail[];

  constructor(detail: string | ValidationErrorDetail[] | undefined) {
    let message: string;
    let details: ValidationErrorDetail[] | undefined;
    
    if (Array.isArray(detail)) {
      details = detail;
      message = detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
    } else if (typeof detail === 'string') {
      message = detail;
    } else {
      message = 'Check your input params';
    }
    
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class BadInputError extends APIError {
  statusCode: number = 400
  details?: ValidationErrorDetail[];

  constructor(detail: string | ValidationErrorDetail[] | undefined) {
    let message: string;
    let details: ValidationErrorDetail[] | undefined;
    
    if (Array.isArray(detail)) {
      details = detail;
      message = detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
    } else if (typeof detail === 'string') {
      message = detail;
    } else {
      message = 'Check your input params';
    }
    
    super(message);
    this.name = 'BadInputError';
    this.details = details;
  }
}

export class BrowserNotSupportedError extends HiggsfieldError {
  constructor() {
    super('This SDK is not supported in browser environments. Please use it in a Node.js environment.');
    this.name = 'BrowserNotSupportedError';
  }
}
