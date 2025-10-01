import { Config } from './config';
import { CredentialsMissedError } from './errors';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should use default values for optional properties', () => {
      const config = new Config();

      expect(config.baseURL).toBe('https://platform.higgsfield.ai');
      expect(config.timeout).toBe(120000);
      expect(config.maxRetries).toBe(3);
      expect(config.retryBackoff).toBe(1000);
      expect(config.retryMaxBackoff).toBe(60000);
      expect(config.pollInterval).toBe(2000);
      expect(config.maxPollTime).toBe(300000);
    });

    it('should use provided custom values', () => {
      const customConfig = {
        baseURL: 'https://custom.api.com',
        timeout: 60000,
        maxRetries: 5,
        retryBackoff: 2000,
        retryMaxBackoff: 30000,
        pollInterval: 1000,
        maxPollTime: 600000
      };

      const config = new Config(customConfig);

      expect(config.baseURL).toBe('https://custom.api.com');
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(5);
      expect(config.retryBackoff).toBe(2000);
      expect(config.retryMaxBackoff).toBe(30000);
      expect(config.pollInterval).toBe(1000);
      expect(config.maxPollTime).toBe(600000);
    });

    it('should validate maxRetries is not greater than 5', () => {
      expect(() => new Config({
        maxRetries: 6
      })).toThrow('maxRetries cannot be greater than 5');
    });

    it('should allow maxRetries up to 5', () => {
      const config = new Config({
        maxRetries: 5
      });

      expect(config.maxRetries).toBe(5);
    });
  });
});