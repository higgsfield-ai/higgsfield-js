import axios from 'axios';
import { HiggsfieldClient } from './client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HiggsfieldClient upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeClient(post: jest.Mock) {
    mockedAxios.create.mockReturnValue({
      post,
      get: jest.fn(),
      interceptors: { response: { use: jest.fn() } }
    } as never);

    return new HiggsfieldClient({ apiKey: 'test-key', apiSecret: 'test-secret' });
  }

  it('forwards upload_headers from generate-upload-url to the presigned PUT', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        upload_url: 'https://bucket.s3.amazonaws.com/object.png?X-Amz-Signature=abc',
        public_url: 'https://cdn.higgsfield.ai/object.png',
        upload_headers: { 'Content-Type': 'image/png', 'x-amz-tagging': 'retention=temporary' }
      }
    });
    const client = makeClient(post);
    mockedAxios.put.mockResolvedValue({ data: {} });

    const publicUrl = await client.upload(Buffer.from('data'), 'image/png');

    expect(publicUrl).toBe('https://cdn.higgsfield.ai/object.png');
    expect(mockedAxios.put).toHaveBeenCalledWith(
      'https://bucket.s3.amazonaws.com/object.png?X-Amz-Signature=abc',
      expect.any(Buffer),
      { headers: { 'Content-Type': 'image/png', 'x-amz-tagging': 'retention=temporary' } }
    );
  });

  it('still uploads when the server omits upload_headers (backward compatible)', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        upload_url: 'https://bucket.s3.amazonaws.com/object.jpg',
        public_url: 'https://cdn.higgsfield.ai/object.jpg'
      }
    });
    const client = makeClient(post);
    mockedAxios.put.mockResolvedValue({ data: {} });

    await client.uploadImage(Buffer.from('data'), 'jpeg');

    expect(mockedAxios.put).toHaveBeenCalledWith(
      'https://bucket.s3.amazonaws.com/object.jpg',
      expect.any(Buffer),
      { headers: { 'Content-Type': 'image/jpeg' } }
    );
  });
});
