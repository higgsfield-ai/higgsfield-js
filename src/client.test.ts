import axios from 'axios';
import { HiggsfieldClient } from './client';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeClient(post: jest.Mock): HiggsfieldClient {
  mockedAxios.create.mockReturnValue({
    post,
    get: jest.fn(),
    interceptors: { response: { use: jest.fn() } },
  } as never);
  return new HiggsfieldClient({ apiKey: 'test-key', apiSecret: 'test-secret' });
}

describe('HiggsfieldClient.upload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedAxios.put.mockResolvedValue({ status: 200 } as never);
  });

  it('sends every header returned in upload_headers with the presigned PUT', async () => {
    const uploadHeaders = {
      'Content-Type': 'image/png',
      'x-amz-tagging': 'retention=temporary',
    };
    const post = jest.fn().mockResolvedValue({
      data: {
        upload_url: 'https://bucket.s3.example/key?signature=abc',
        public_url: 'https://cdn.example/key.png',
        upload_headers: uploadHeaders,
      },
    });
    const client = makeClient(post);
    const data = Buffer.from('png-bytes');

    const publicUrl = await client.upload(data, 'image/png');

    expect(publicUrl).toBe('https://cdn.example/key.png');
    expect(post).toHaveBeenCalledWith('/files/generate-upload-url', { content_type: 'image/png' });
    expect(mockedAxios.put).toHaveBeenCalledTimes(1);
    const [url, body, options] = mockedAxios.put.mock.calls[0];
    expect(url).toBe('https://bucket.s3.example/key?signature=abc');
    expect(body).toBe(data);
    expect(options?.headers).toEqual(uploadHeaders);
  });

  it('falls back to the content type when the API returns no upload_headers', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        upload_url: 'https://bucket.s3.example/key',
        public_url: 'https://cdn.example/key.jpg',
      },
    });
    const client = makeClient(post);

    await client.upload(Buffer.from('jpeg-bytes'), 'image/jpeg');

    const [, , options] = mockedAxios.put.mock.calls[0];
    expect(options?.headers).toEqual({ 'Content-Type': 'image/jpeg' });
  });
});
