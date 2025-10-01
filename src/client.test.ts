import { HiggsfieldClient } from './client';
import { 
  AuthenticationError, 
  BadInputError, 
  ValidationError, 
  NotEnoughCreditsError, 
  APIError 
} from './errors';
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
});