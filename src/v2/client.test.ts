import { createHiggsfieldClient, configure, reset } from './client';
import { BrowserNotSupportedError, BadInputError } from '../errors';

describe('V2 Client', () => {
  beforeEach(() => {
    reset();
  });

  afterEach(() => {
    reset();
  });

  describe('Configuration', () => {
    it('should create client with credentials string', () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      expect(client).toBeDefined();
      expect(typeof client.subscribe).toBe('function');
      expect(typeof client.configure).toBe('function');
    });

    it('should create client with separate apiKey and apiSecret', () => {
      const client = createHiggsfieldClient({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(client).toBeDefined();
    });

    it('should throw error for invalid credentials format', () => {
      expect(() => {
        createHiggsfieldClient({
          credentials: 'invalid-format',
        });
      }).toThrow(BadInputError);
    });

    it('should configure client globally', () => {
      configure({
        credentials: 'global-key:global-secret',
      });

      // Configuration should not throw
      expect(true).toBe(true);
    });
  });

  describe('Browser Environment Check', () => {
    it('should throw BrowserNotSupportedError in browser environment', () => {
      // Mock window object
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = {};

      expect(() => {
        createHiggsfieldClient({
          credentials: 'test-key:test-secret',
        });
      }).toThrow(BrowserNotSupportedError);

      // Restore
      (globalThis as any).window = originalWindow;
    });
  });
});

