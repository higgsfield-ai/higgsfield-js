import { createHiggsfieldClient, configure, reset } from './client';
import {
  AuthenticationError,
  BadInputError,
  ValidationError,
  NotEnoughCreditsError,
  APIError,
  BrowserNotSupportedError,
  CredentialsMissedError,
} from '../errors';
import { JobSet } from '../models/JobSet';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock retryWithBackoff to avoid actual retry logic in tests
jest.mock('../utils/retry', () => ({
  retryWithBackoff: jest.fn((fn) => fn()),
}));

// Mock fetchCredentials
jest.mock('../auth', () => ({
  fetchCredentials: jest.fn(() => ({
    apiKey: 'env-key',
    apiSecret: 'env-secret',
  })),
}));

describe('V2 Client', () => {
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    reset();

    // Create a mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as any;

    // Mock axios.create to return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    reset();
  });

  describe('Configuration', () => {
    it('should configure client with credentials string', () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      expect(mockedAxios.create).toHaveBeenCalled();
      const createCall = mockedAxios.create.mock.calls[0][0];
      expect(createCall?.headers?.Authorization).toBe('Key test-key:test-secret');
    });

    it('should configure client with separate apiKey and apiSecret', () => {
      const client = createHiggsfieldClient({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(mockedAxios.create).toHaveBeenCalled();
      const createCall = mockedAxios.create.mock.calls[0][0];
      expect(createCall?.headers?.Authorization).toBe('Key test-key:test-secret');
    });

    it('should throw error for invalid credentials format', () => {
      expect(() => {
        createHiggsfieldClient({
          credentials: 'invalid-format',
        });
      }).toThrow(BadInputError);
    });

    it('should use global config function', () => {
      configure({
        credentials: 'global-key:global-secret',
      });

      expect(mockedAxios.create).toHaveBeenCalled();
    });
  });

  describe('subscribe - nano-banana-pro', () => {
    it('should successfully subscribe to nano-banana-pro endpoint', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-request-id-123',
          status_url: 'https://platform.higgsfield.ai/requests/test-request-id-123/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-request-id-123/cancel',
        },
      };

      const mockPollingResponse = {
        status: 200,
        data: {
          status: 'completed',
          request_id: 'test-request-id-123',
          images: [{ url: 'https://example.com/image.jpg' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);
      mockAxiosInstance.get.mockResolvedValueOnce(mockPollingResponse as any);

      const jobSet = await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'A beautiful sunset over mountains',
          aspect_ratio: '16:9',
        },
        withPolling: true,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/nano-banana-pro',
        {
          prompt: 'A beautiful sunset over mountains',
          aspect_ratio: '16:9',
        }
      );

      expect(jobSet).toBeInstanceOf(JobSet);
      expect(jobSet.id).toBe('test-request-id-123');
      expect(jobSet.jobs.length).toBeGreaterThan(0);
    });

    it('should handle nano-banana-pro without polling', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-request-id-456',
          status_url: 'https://platform.higgsfield.ai/requests/test-request-id-456/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-request-id-456/cancel',
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);

      const jobSet = await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'Test prompt',
          aspect_ratio: '1:1',
        },
        withPolling: false,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalled();
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
      expect(jobSet.id).toBe('test-request-id-456');
    });

    it('should add webhook as query parameter for nano-banana-pro', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-request-id-789',
          status_url: 'https://platform.higgsfield.ai/requests/test-request-id-789/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-request-id-789/cancel',
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);

      await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'Test with webhook',
        },
        webhook: {
          url: 'https://example.com/webhook',
          secret: 'webhook-secret',
        },
        withPolling: false,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('hf_webhook='),
        expect.any(Object)
      );
    });

    it('should handle nano-banana-pro with video response', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-request-id-video',
          status_url: 'https://platform.higgsfield.ai/requests/test-request-id-video/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-request-id-video/cancel',
        },
      };

      const mockPollingResponse = {
        status: 200,
        data: {
          status: 'completed',
          request_id: 'test-request-id-video',
          video: { url: 'https://example.com/video.mp4' },
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);
      mockAxiosInstance.get.mockResolvedValueOnce(mockPollingResponse as any);

      const jobSet = await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'Generate a video',
        },
        withPolling: true,
      });

      expect(jobSet.isCompleted).toBe(true);
      expect(jobSet.jobs[0].results?.raw.url).toBe('https://example.com/video.mp4');
    });

    it('should handle nano-banana-pro with multiple images', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-request-id-multi',
          status_url: 'https://platform.higgsfield.ai/requests/test-request-id-multi/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-request-id-multi/cancel',
        },
      };

      const mockPollingResponse = {
        status: 200,
        data: {
          status: 'completed',
          request_id: 'test-request-id-multi',
          images: [
            { url: 'https://example.com/image1.jpg' },
            { url: 'https://example.com/image2.jpg' },
          ],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);
      mockAxiosInstance.get.mockResolvedValueOnce(mockPollingResponse as any);

      const jobSet = await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'Generate multiple images',
        },
        withPolling: true,
      });

      expect(jobSet.isCompleted).toBe(true);
      // Should use first image
      expect(jobSet.jobs[0].results?.raw.url).toBe('https://example.com/image1.jpg');
    });
  });

  describe('Error Handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const errorResponse = {
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      };

      // Mock the response interceptor to throw the error
      const responseInterceptor = mockAxiosInstance.interceptors.response.use as jest.Mock;
      const errorHandler = responseInterceptor.mock.calls[0]?.[1];

      if (errorHandler) {
        await expect(errorHandler(errorResponse)).rejects.toThrow(AuthenticationError);
      }
    });

    it('should throw NotEnoughCreditsError on 403', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const errorResponse = {
        response: {
          status: 403,
          data: {},
        },
      };

      const responseInterceptor = mockAxiosInstance.interceptors.response.use as jest.Mock;
      const errorHandler = responseInterceptor.mock.calls[0]?.[1];

      if (errorHandler) {
        await expect(errorHandler(errorResponse)).rejects.toThrow(NotEnoughCreditsError);
      }
    });

    it('should throw ValidationError on 422', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const errorResponse = {
        response: {
          status: 422,
          data: {
            detail: [{ type: 'validation_error', msg: 'Invalid input' }],
          },
        },
      };

      const responseInterceptor = mockAxiosInstance.interceptors.response.use as jest.Mock;
      const errorHandler = responseInterceptor.mock.calls[0]?.[1];

      if (errorHandler) {
        await expect(errorHandler(errorResponse)).rejects.toThrow(ValidationError);
      }
    });

    it('should throw BadInputError on 400', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const errorResponse = {
        response: {
          status: 400,
          data: {
            detail: 'Bad input',
          },
        },
      };

      const responseInterceptor = mockAxiosInstance.interceptors.response.use as jest.Mock;
      const errorHandler = responseInterceptor.mock.calls[0]?.[1];

      if (errorHandler) {
        await expect(errorHandler(errorResponse)).rejects.toThrow(BadInputError);
      }
    });

    it('should throw CredentialsMissedError when no credentials provided', async () => {
      const client = createHiggsfieldClient();

      // Mock fetchCredentials to throw
      const { fetchCredentials } = require('../auth');
      (fetchCredentials as jest.Mock).mockImplementationOnce(() => {
        throw new CredentialsMissedError();
      });

      await expect(
        client.subscribe('nano-banana-pro', {
          input: { prompt: 'Test' },
        })
      ).rejects.toThrow(CredentialsMissedError);
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

  describe('Polling Status Transitions', () => {
    it('should handle status transitions: queued -> in_progress -> completed', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-polling-id',
          status_url: 'https://platform.higgsfield.ai/requests/test-polling-id/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-polling-id/cancel',
        },
      };

      const mockPollingQueued = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-polling-id',
        },
      };

      const mockPollingInProgress = {
        status: 200,
        data: {
          status: 'in_progress',
          request_id: 'test-polling-id',
        },
      };

      const mockPollingCompleted = {
        status: 200,
        data: {
          status: 'completed',
          request_id: 'test-polling-id',
          images: [{ url: 'https://example.com/final-image.jpg' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);
      mockAxiosInstance.get
        .mockResolvedValueOnce(mockPollingQueued as any)
        .mockResolvedValueOnce(mockPollingInProgress as any)
        .mockResolvedValueOnce(mockPollingCompleted as any);

      const jobSet = await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'Test polling transitions',
        },
        withPolling: true,
      });

      expect(jobSet.isCompleted).toBe(true);
      expect(jobSet.jobs[0].results?.raw.url).toBe('https://example.com/final-image.jpg');
    });

    it('should handle failed status', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-failed-id',
          status_url: 'https://platform.higgsfield.ai/requests/test-failed-id/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-failed-id/cancel',
        },
      };

      const mockPollingFailed = {
        status: 200,
        data: {
          status: 'failed',
          request_id: 'test-failed-id',
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);
      mockAxiosInstance.get.mockResolvedValueOnce(mockPollingFailed as any);

      const jobSet = await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'Test failure',
        },
        withPolling: true,
      });

      expect(jobSet.isFailed).toBe(true);
    });

    it('should handle nsfw status', async () => {
      const client = createHiggsfieldClient({
        credentials: 'test-key:test-secret',
      });

      const mockResponse = {
        status: 200,
        data: {
          status: 'queued',
          request_id: 'test-nsfw-id',
          status_url: 'https://platform.higgsfield.ai/requests/test-nsfw-id/status',
          cancel_url: 'https://platform.higgsfield.ai/requests/test-nsfw-id/cancel',
        },
      };

      const mockPollingNsfw = {
        status: 200,
        data: {
          status: 'nsfw',
          request_id: 'test-nsfw-id',
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as any);
      mockAxiosInstance.get.mockResolvedValueOnce(mockPollingNsfw as any);

      const jobSet = await client.subscribe('nano-banana-pro', {
        input: {
          prompt: 'Test NSFW',
        },
        withPolling: true,
      });

      expect(jobSet.isNsfw).toBe(true);
    });
  });
});

