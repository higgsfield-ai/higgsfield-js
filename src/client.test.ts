import { HiggsfieldClient } from './client';
import { 
  AuthenticationError, 
  BadInputError, 
  ValidationError, 
  NotEnoughCreditsError, 
  APIError 
} from './errors';
import { SoulIdStatus, InputImageType } from './types';
import { SoulId } from './models/SoulId';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HiggsfieldClient', () => {
  let client: HiggsfieldClient;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock axios.create to return mocked axios instance
    mockedAxios.create.mockReturnValue(mockedAxios);
    
    // Mock interceptors
    mockedAxios.interceptors = {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    } as any;
    
    client = new HiggsfieldClient({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret'
    });
  });

  describe('Constructor', () => {
    it('should create client with provided credentials', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://platform.higgsfield.ai',
          timeout: 120000,
          headers: expect.objectContaining({
            'hf-api-key': 'test-api-key',
            'hf-secret': 'test-api-secret'
          })
        })
      );
    });

    it('should set up response interceptors', () => {
      expect(mockedAxios.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('getSoulStyles', () => {
    it('should return soul styles on successful request', async () => {
      const mockStyles = [
        {
          id: 'style-1',
          name: 'Oil Painting',
          description: 'Classic oil painting style',
          preview_url: 'https://example.com/preview.jpg'
        }
      ];
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockStyles });
      
      const result = await client.getSoulStyles();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/v1/text2image/soul-styles');
      expect(result).toEqual(mockStyles);
    });
  });

  describe('getMotions', () => {
    it('should return motions on successful request', async () => {
      const mockMotions = [
        {
          id: 'motion-1',
          name: 'Zoom In',
          description: 'Smooth zoom effect',
          preview_url: 'https://example.com/motion.mp4',
          start_end_frame: true
        }
      ];
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockMotions });
      
      const result = await client.getMotions();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/v1/motions');
      expect(result).toEqual(mockMotions);
    });
  });

  describe('upload', () => {
    it('should call upload endpoint', async () => {
      const mockResponse = {
        upload_url: 'https://upload.example.com/123',
        public_url: 'https://cdn.example.com/123.jpg'
      };
      
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });
      
      const testData = Buffer.from('test data');
      const result = await client.upload(testData, 'image/jpeg');
      
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(result).toBe(mockResponse.public_url);
    });
  });

  describe('uploadImage', () => {
    it('should upload image', async () => {
      const mockResponse = {
        upload_url: 'https://upload.example.com/123',
        public_url: 'https://cdn.example.com/123.jpg'
      };
      
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });
      
      const imageBuffer = Buffer.from('fake image data');
      const result = await client.uploadImage(imageBuffer, 'jpeg');
      
      expect(result).toBe(mockResponse.public_url);
    });
  });

  describe('Response Interceptor Error Handling', () => {
    let responseInterceptor: (error: any) => void;
    
    beforeEach(() => {
      // Get the error handler from the response interceptor
      const interceptorCall = (mockedAxios.interceptors.response.use as jest.Mock).mock.calls[0];
      responseInterceptor = interceptorCall[1]; // Error handler is the second argument
    });

    it('should throw AuthenticationError for 401 status', () => {
      const error = {
        response: { status: 401 }
      };
      
      expect(() => responseInterceptor(error)).toThrow(AuthenticationError);
    });

    it('should throw NotEnoughCreditsError for 403 status', () => {
      const error = {
        response: { status: 403 }
      };
      
      expect(() => responseInterceptor(error)).toThrow(NotEnoughCreditsError);
    });

    it('should throw BadInputError for 400 status', () => {
      const error = {
        response: { 
          status: 400,
          data: { detail: 'Invalid input' }
        }
      };
      
      expect(() => responseInterceptor(error)).toThrow(BadInputError);
    });

    it('should throw ValidationError for 422 status', () => {
      const error = {
        response: { 
          status: 422,
          data: { 
            detail: [
              {
                type: 'literal_error',
                loc: ['batch_size'],
                msg: 'Input should be 1 or 4',
                input: 2
              }
            ]
          }
        }
      };
      
      expect(() => responseInterceptor(error)).toThrow(ValidationError);
    });

    it('should throw APIError for other response errors', () => {
      const error = {
        response: { 
          status: 500,
          data: { error: 'Internal server error' }
        },
        message: 'Server error'
      };
      
      expect(() => responseInterceptor(error)).toThrow(APIError);
    });

    it('should re-throw non-response errors', () => {
      const error = new Error('Network error');
      
      expect(() => responseInterceptor(error)).toThrow('Network error');
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      new HiggsfieldClient({
        apiKey: 'custom-key',
        apiSecret: 'custom-secret',
        baseURL: 'https://custom.api.com',
        timeout: 60000,
        maxRetries: 5
      });
      
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://custom.api.com',
          timeout: 60000
        })
      );
    });
  });

  describe('SoulId Methods', () => {
    describe('createSoulId', () => {
      it('should create a SoulId successfully', async () => {
        const mockSoulIdData = {
          id: 'soul-123',
          name: 'Test Character',
          status: SoulIdStatus.QUEUED
        };

        const mockCompletedData = {
          id: 'soul-123',
          name: 'Test Character',
          status: SoulIdStatus.COMPLETED
        };

        // Mock the initial creation
        mockedAxios.post.mockResolvedValueOnce({ data: mockSoulIdData });
        
        // Mock polling responses
        mockedAxios.get
          .mockResolvedValueOnce({ data: { status: SoulIdStatus.IN_PROGRESS } })
          .mockResolvedValueOnce({ data: { status: SoulIdStatus.COMPLETED } });

        const createData = {
          name: 'Test Character',
          input_images: [
            { type: InputImageType.IMAGE_URL, image_url: 'https://example.com/img1.jpg' },
            { type: InputImageType.IMAGE_URL, image_url: 'https://example.com/img2.jpg' }
          ]
        };

        const result = await client.createSoulId(createData, true);

        expect(mockedAxios.post).toHaveBeenCalledWith('/v1/custom-references', createData);
        expect(result).toBeInstanceOf(SoulId);
        expect(result.id).toBe('soul-123');
        expect(result.name).toBe('Test Character');
        expect(result.status).toBe(SoulIdStatus.COMPLETED);
      });

      it('should create a SoulId without polling', async () => {
        const mockSoulIdData = {
          id: 'soul-456',
          name: 'Another Character',
          status: SoulIdStatus.QUEUED
        };

        mockedAxios.post.mockResolvedValueOnce({ data: mockSoulIdData });

        const createData = {
          name: 'Another Character',
          input_images: [
            { type: InputImageType.IMAGE_URL, image_url: 'https://example.com/img3.jpg' }
          ]
        };

        const result = await client.createSoulId(createData, false);

        expect(mockedAxios.post).toHaveBeenCalledWith('/v1/custom-references', createData);
        expect(mockedAxios.get).not.toHaveBeenCalled(); // No polling
        expect(result).toBeInstanceOf(SoulId);
        expect(result.status).toBe(SoulIdStatus.QUEUED);
      });

      it('should handle creation errors', async () => {
        const error = {
          response: {
            status: 400,
            data: { detail: 'Invalid input images' }
          }
        };

        mockedAxios.post.mockRejectedValueOnce(error);

        const createData = {
          name: 'Bad Character',
          input_images: []
        };

        // The interceptor will catch this and throw BadInputError
        const interceptorCall = (mockedAxios.interceptors.response.use as jest.Mock).mock.calls[0];
        const responseInterceptor = interceptorCall[1];
        
        await expect(async () => {
          try {
            await client.createSoulId(createData);
          } catch (e) {
            throw responseInterceptor(error);
          }
        }).rejects.toThrow(BadInputError);
      });
    });

    describe('listSoulIds', () => {
      it('should list SoulIds with default pagination', async () => {
        const mockResponse = {
          total: 15,
          page: 1,
          page_size: 20,
          total_pages: 1,
          items: [
            {
              id: 'soul-1',
              name: 'Character 1',
              status: SoulIdStatus.COMPLETED
            },
            {
              id: 'soul-2',
              name: 'Character 2',
              status: SoulIdStatus.IN_PROGRESS
            }
          ]
        };

        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await client.listSoulIds();

        expect(mockedAxios.get).toHaveBeenCalledWith('/v1/custom-references/list', {
          params: { page: 1, page_size: 20 }
        });
        expect(result.total).toBe(15);
        expect(result.items).toHaveLength(2);
        expect(result.items[0]).toBeInstanceOf(SoulId);
        expect(result.items[0].id).toBe('soul-1');
      });

      it('should list SoulIds with custom pagination', async () => {
        const mockResponse = {
          total: 50,
          page: 2,
          page_size: 10,
          total_pages: 5,
          items: [
            {
              id: 'soul-11',
              name: 'Character 11',
              status: SoulIdStatus.QUEUED
            }
          ]
        };

        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await client.listSoulIds(2, 10);

        expect(mockedAxios.get).toHaveBeenCalledWith('/v1/custom-references/list', {
          params: { page: 2, page_size: 10 }
        });
        expect(result.page).toBe(2);
        expect(result.page_size).toBe(10);
        expect(result.total_pages).toBe(5);
        expect(result.items[0].name).toBe('Character 11');
      });

      it('should handle empty list response', async () => {
        const mockResponse = {
          total: 0,
          page: 1,
          page_size: 20,
          total_pages: 0,
          items: []
        };

        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await client.listSoulIds();

        expect(result.total).toBe(0);
        expect(result.items).toEqual([]);
        expect(result.total_pages).toBe(0);
      });

      it('should handle list errors', async () => {
        const error = {
          response: {
            status: 401,
            data: { detail: 'Unauthorized' }
          }
        };

        mockedAxios.get.mockRejectedValueOnce(error);

        const interceptorCall = (mockedAxios.interceptors.response.use as jest.Mock).mock.calls[0];
        const responseInterceptor = interceptorCall[1];
        
        await expect(async () => {
          try {
            await client.listSoulIds();
          } catch (e) {
            throw responseInterceptor(error);
          }
        }).rejects.toThrow(AuthenticationError);
      });
    });
  });
});