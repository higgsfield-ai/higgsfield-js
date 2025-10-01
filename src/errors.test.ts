import {
  HiggsfieldError,
  AuthenticationError,
  CredentialsMissedError,
  APIError,
  TimeoutError,
  NotEnoughCreditsError,
  ValidationError,
  BadInputError
} from './errors';

describe('Error Classes', () => {
  describe('HiggsfieldError', () => {
    it('should create base error with message', () => {
      const message = 'Base error message';
      const error = new HiggsfieldError(message);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('HiggsfieldError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication failed');
      expect(error.name).toBe('AuthenticationError');
      expect(error).toBeInstanceOf(HiggsfieldError);
    });

    it('should create authentication error with custom message', () => {
      const message = 'Invalid API key';
      const error = new AuthenticationError(message);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('AuthenticationError');
    });
  });

  describe('CredentialsMissedError', () => {
    it('should create credentials missed error', () => {
      const error = new CredentialsMissedError();
      
      expect(error.message).toBe('API credentials not found. Set HF_API_KEY and HF_API_SECRET environment variables or pass them in config.');
      expect(error.name).toBe('CredentialsMissedError');
      expect(error).toBeInstanceOf(HiggsfieldError);
    });
  });

  describe('APIError', () => {
    it('should create API error with message only', () => {
      const message = 'API request failed';
      const error = new APIError(message);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('APIError');
      expect(error.statusCode).toBeUndefined();
      expect(error.responseData).toBeUndefined();
    });

    it('should create API error with status code and response data', () => {
      const message = 'API request failed';
      const statusCode = 500;
      const responseData = { error: 'Internal server error' };
      const error = new APIError(message, statusCode, responseData);
      
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.responseData).toEqual(responseData);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const message = 'Request timeout';
      const error = new TimeoutError(message);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('TimeoutError');
      expect(error).toBeInstanceOf(HiggsfieldError);
    });
  });

  describe('NotEnoughCreditsError', () => {
    it('should create not enough credits error', () => {
      const error = new NotEnoughCreditsError();
      
      expect(error.message).toBe('Not enough credits');
      expect(error.name).toBe('AccountError');
      expect(error.statusCode).toBe(403);
      expect(error).toBeInstanceOf(APIError);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with string detail', () => {
      const detail = 'Invalid input parameter';
      const error = new ValidationError(detail);
      
      expect(error.message).toBe(detail);
      expect(error.name).toBe('ValidationError');
      expect(error.statusCode).toBe(422);
      expect(error.details).toBeUndefined();
    });

    it('should create validation error with array of details', () => {
      const details = [
        {
          type: 'literal_error',
          loc: ['body', 'params', 'batch_size'],
          msg: 'Input should be 1 or 4',
          input: 2,
          ctx: { expected: '1 or 4' }
        },
        {
          type: 'missing',
          loc: ['body', 'params', 'prompt'],
          msg: 'Field required',
          input: null
        }
      ];
      const error = new ValidationError(details);
      
      expect(error.message).toBe('body.params.batch_size: Input should be 1 or 4, body.params.prompt: Field required');
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(details);
    });

    it('should create validation error with undefined detail', () => {
      const error = new ValidationError(undefined);
      
      expect(error.message).toBe('Check your input params');
      expect(error.name).toBe('ValidationError');
      expect(error.details).toBeUndefined();
    });

    it('should handle single validation detail', () => {
      const details = [
        {
          type: 'literal_error',
          loc: ['batch_size'],
          msg: 'Must be 1 or 4',
          input: 3
        }
      ];
      const error = new ValidationError(details);
      
      expect(error.message).toBe('batch_size: Must be 1 or 4');
      expect(error.details).toEqual(details);
    });
  });

  describe('BadInputError', () => {
    it('should create bad input error with string detail', () => {
      const detail = 'Invalid parameter value';
      const error = new BadInputError(detail);
      
      expect(error.message).toBe(detail);
      expect(error.name).toBe('BadInputError');
      expect(error.statusCode).toBe(400);
      expect(error.details).toBeUndefined();
    });

    it('should create bad input error with array of details', () => {
      const details = [
        {
          type: 'value_error',
          loc: ['strength'],
          msg: 'Must be between 0 and 1',
          input: 1.5
        }
      ];
      const error = new BadInputError(details);
      
      expect(error.message).toBe('strength: Must be between 0 and 1');
      expect(error.name).toBe('BadInputError');
      expect(error.details).toEqual(details);
    });

    it('should create bad input error with undefined detail', () => {
      const error = new BadInputError(undefined);
      
      expect(error.message).toBe('Check your input params');
      expect(error.name).toBe('BadInputError');
      expect(error.details).toBeUndefined();
    });
  });

  describe('Error inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const authError = new AuthenticationError();
      const apiError = new APIError('test');
      const validationError = new ValidationError('test');
      const badInputError = new BadInputError('test');
      
      expect(authError).toBeInstanceOf(HiggsfieldError);
      expect(authError).toBeInstanceOf(Error);
      
      expect(apiError).toBeInstanceOf(HiggsfieldError);
      expect(apiError).toBeInstanceOf(Error);
      
      expect(validationError).toBeInstanceOf(APIError);
      expect(validationError).toBeInstanceOf(HiggsfieldError);
      expect(validationError).toBeInstanceOf(Error);
      
      expect(badInputError).toBeInstanceOf(APIError);
      expect(badInputError).toBeInstanceOf(HiggsfieldError);
      expect(badInputError).toBeInstanceOf(Error);
    });
  });
});