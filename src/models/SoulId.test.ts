import axios, { AxiosInstance } from 'axios';
import { SoulId } from './SoulId';
import { Config } from '../config';
import { TimeoutError } from '../errors';
import { SoulIdStatus, SoulIdData } from '../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SoulId', () => {
  let mockClient: jest.Mocked<AxiosInstance>;
  let mockConfig: Config;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      getUri: jest.fn(),
      defaults: {},
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
      },
    } as any;

    mockConfig = new Config({
      pollInterval: 100,
      maxPollTime: 1000,
    });

    mockedAxios.isAxiosError = jest.fn(() => false) as any;
  });

  describe('constructor', () => {
    it('should initialize SoulId with provided data', () => {
      const data: SoulIdData = {
        id: 'soul-123',
        name: 'Test Character',
        status: SoulIdStatus.QUEUED,
      };

      const soulId = new SoulId(data);

      expect(soulId.id).toBe('soul-123');
      expect(soulId.name).toBe('Test Character');
      expect(soulId.status).toBe(SoulIdStatus.QUEUED);
    });
  });

  describe('pollingUrl', () => {
    it('should return correct polling URL', () => {
      const data: SoulIdData = {
        id: 'soul-456',
        name: 'Another Character',
        status: SoulIdStatus.IN_PROGRESS,
      };

      const soulId = new SoulId(data);
      expect(soulId.pollingUrl).toBe('/v1/custom-references/soul-456');
    });
  });

  describe('status checks', () => {
    it('should correctly identify completed status', () => {
      const completedSoulId = new SoulId({
        id: 'soul-1',
        name: 'Character 1',
        status: SoulIdStatus.COMPLETED,
      });

      expect(completedSoulId.isCompleted).toBe(true);
      expect(completedSoulId.isFailed).toBe(false);
    });

    it('should correctly identify failed status', () => {
      const failedSoulId = new SoulId({
        id: 'soul-2',
        name: 'Character 2',
        status: SoulIdStatus.FAILED,
      });

      expect(failedSoulId.isCompleted).toBe(false);
      expect(failedSoulId.isFailed).toBe(true);
    });

    it('should correctly identify in-progress status', () => {
      const inProgressSoulId = new SoulId({
        id: 'soul-3',
        name: 'Character 3',
        status: SoulIdStatus.IN_PROGRESS,
      });

      expect(inProgressSoulId.isCompleted).toBe(false);
      expect(inProgressSoulId.isFailed).toBe(false);
    });

    it('should correctly identify queued status', () => {
      const queuedSoulId = new SoulId({
        id: 'soul-4',
        name: 'Character 4',
        status: SoulIdStatus.QUEUED,
      });

      expect(queuedSoulId.isCompleted).toBe(false);
      expect(queuedSoulId.isFailed).toBe(false);
    });
  });

  describe('poll', () => {
    it('should poll until status is completed', async () => {
      const soulId = new SoulId({
        id: 'soul-poll-1',
        name: 'Poll Test 1',
        status: SoulIdStatus.QUEUED,
      });

      mockClient.get
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.QUEUED } })
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.IN_PROGRESS } })
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.COMPLETED } });

      await soulId.poll(mockClient, mockConfig);

      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(mockClient.get).toHaveBeenCalledWith('/v1/custom-references/soul-poll-1');
      expect(soulId.status).toBe(SoulIdStatus.COMPLETED);
      expect(soulId.isCompleted).toBe(true);
    });

    it('should poll until status is failed', async () => {
      const soulId = new SoulId({
        id: 'soul-poll-2',
        name: 'Poll Test 2',
        status: SoulIdStatus.QUEUED,
      });

      mockClient.get
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.QUEUED } })
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.IN_PROGRESS } })
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.FAILED } });

      await soulId.poll(mockClient, mockConfig);

      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(soulId.status).toBe(SoulIdStatus.FAILED);
      expect(soulId.isFailed).toBe(true);
    });

    it('should throw TimeoutError when polling exceeds max time', async () => {
      const soulId = new SoulId({
        id: 'soul-timeout',
        name: 'Timeout Test',
        status: SoulIdStatus.QUEUED,
      });

      mockClient.get.mockResolvedValue({ data: { status: SoulIdStatus.QUEUED } });

      const shortConfig = new Config({ maxPollTime: 200, pollInterval: 100 });

      await expect(soulId.poll(mockClient, shortConfig)).rejects.toThrow(TimeoutError);
      await expect(soulId.poll(mockClient, shortConfig)).rejects.toThrow(
        'Polling exceeded maximum time of 200ms'
      );
    });

    it('should continue polling on 500+ server errors', async () => {
      const soulId = new SoulId({
        id: 'soul-error',
        name: 'Error Test',
        status: SoulIdStatus.QUEUED,
      });

      const serverError = {
        response: { status: 503 },
        isAxiosError: true,
      };

      mockedAxios.isAxiosError = jest.fn(() => true) as any;

      mockClient.get
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.IN_PROGRESS } })
        .mockResolvedValueOnce({ data: { status: SoulIdStatus.COMPLETED } });

      await soulId.poll(mockClient, mockConfig);

      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(soulId.status).toBe(SoulIdStatus.COMPLETED);
    });

    it('should throw non-server errors immediately', async () => {
      const soulId = new SoulId({
        id: 'soul-client-error',
        name: 'Client Error Test',
        status: SoulIdStatus.QUEUED,
      });

      const clientError = new Error('Network error');
      mockClient.get.mockRejectedValueOnce(clientError);

      await expect(soulId.poll(mockClient, mockConfig)).rejects.toThrow('Network error');
      expect(mockClient.get).toHaveBeenCalledTimes(1);
    });

    it('should throw 4xx errors immediately', async () => {
      const soulId = new SoulId({
        id: 'soul-400-error',
        name: '400 Error Test',
        status: SoulIdStatus.QUEUED,
      });

      const clientError = {
        response: { status: 404 },
        isAxiosError: true,
      };

      mockedAxios.isAxiosError = jest.fn(() => true) as any;
      mockClient.get.mockRejectedValueOnce(clientError);

      await expect(soulId.poll(mockClient, mockConfig)).rejects.toEqual(clientError);
      expect(mockClient.get).toHaveBeenCalledTimes(1);
    });
  });
});