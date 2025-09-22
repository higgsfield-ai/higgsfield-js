import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { Config, ClientConfig } from './config';
import { fetchCredentials, Credentials } from './auth';
import { APIError, AuthenticationError } from './errors';
import { GenerateParams, UploadResponse } from './types';
import { JobSet } from './models/JobSet';
import { retryWithBackoff } from './utils/retry';

export class HiggsfieldClient {
  private config: Config;
  private client: AxiosInstance;
  private credentials: Credentials;

  constructor(config?: ClientConfig) {
    this.config = new Config(config);
    
    if (this.config.apiKey && this.config.apiSecret) {
      this.credentials = {
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret
      };
    } else {
      this.credentials = fetchCredentials();
    }

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'hf-api-key': this.credentials.apiKey,
        'hf-secret': this.credentials.apiSecret,
        'Content-Type': 'application/json',
        ...this.config.headers
      }
    });

    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          throw new AuthenticationError('Invalid API credentials');
        }
        if (error.response) {
          throw new APIError(
            error.message,
            error.response.status,
            error.response.data
          );
        }
        throw error;
      }
    );
  }

  /**
   * Generate content using Higgsfield API
   */
  async generate(
    endpoint: string,
    params: GenerateParams,
    withPolling: boolean = true
  ): Promise<JobSet> {
    const response = await retryWithBackoff(
      () => this.client.post(endpoint, { params }),
      {
        maxRetries: this.config.maxRetries,
        backoff: this.config.retryBackoff,
        maxBackoff: this.config.retryMaxBackoff
      }
    );

    const jobSet = new JobSet(response.data);
    
    if (withPolling) {
      await jobSet.poll(this.client, this.config);
    }

    return jobSet;
  }

  /**
   * Get upload link for file uploads
   */
  async getUploadLink(contentType: string): Promise<UploadResponse> {
    const response = await this.client.post('/files/generate-upload-url', {
      content_type: contentType
    });
    
    return {
      upload_url: response.data.upload_url,
      public_url: response.data.public_url
    };
  }

  /**
   * Upload data to Higgsfield CDN
   */
  async upload(data: Buffer | Uint8Array, contentType: string): Promise<string> {
    const { upload_url, public_url } = await this.getUploadLink(contentType);

    await axios.put(upload_url, data, {
      headers: { 'Content-Type': contentType }
    });

    return public_url;
  }

  /**
   * Upload an image buffer
   */
  async uploadImage(
    imageBuffer: Buffer,
    format: 'jpeg' | 'png' | 'webp' = 'jpeg'
  ): Promise<string> {
    return this.upload(imageBuffer, `image/${format}`);
  }

  /**
   * Close the client
   */
  close(): void {
    // Cleanup if needed
  }
}
