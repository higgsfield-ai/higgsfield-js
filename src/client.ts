import axios, { AxiosInstance, AxiosError } from 'axios';
import { Config, ClientConfig } from './config';
import { fetchCredentials, Credentials } from './auth';
import { APIError, AuthenticationError, BadInputError, NotEnoughCreditsError, ValidationError } from './errors';
import { GenerateParams, UploadResponse, WebhookPayload, SoulStyle, Motion, SoulIdCreateData, SoulIdListResponse } from './types';
import { JobSet } from './models/JobSet';
import { SoulId } from './models/SoulId';
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
      (error: AxiosError<{ detail?: string | Array<{
        type: string;
        loc: string[];
        msg: string;
        input?: any;
        ctx?: Record<string, any>;
      }> }>) => {
        if (error.response?.status === 401) {
          throw new AuthenticationError('Invalid API credentials');
        } else if(error.response?.status === 403) {
          throw new NotEnoughCreditsError
        } else if(error.response?.status === 422) {
          throw new ValidationError(error.response?.data?.detail)
        } else if(error.response?.status === 400) {
          throw new BadInputError(error.response?.data?.detail)
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
    options?: {
      webhook?: WebhookPayload;
      withPolling?: boolean;
    }
  ): Promise<JobSet> {
    const requestBody: any = { params };
    
    // Only include webhook if provided
    if (options?.webhook) {
      requestBody.webhook = options.webhook;
    }

    const response = await retryWithBackoff(
      () => this.client.post(endpoint, requestBody),
      {
        maxRetries: this.config.maxRetries,
        backoff: this.config.retryBackoff,
        maxBackoff: this.config.retryMaxBackoff
      }
    );

    const jobSet = new JobSet(response.data);
    
    const withPolling = options?.withPolling ?? true;
    if (withPolling) {
      await jobSet.poll(this.client, this.config);
    }

    return jobSet;
  }

  async createSoulId(
    data: SoulIdCreateData,
    withPolling?: boolean
  ): Promise<SoulId> {
    const response = await this.client.post('/v1/custom-references', data);
    const soulId = new SoulId(response.data);

    if (withPolling ?? true) {
      await soulId.poll(this.client, this.config);
    }

    return soulId;
  }

  async listSoulIds(page: number = 1, pageSize: number = 20): Promise<SoulIdListResponse> {
    const response = await this.client.get<SoulIdListResponse>('/v1/custom-references/list', {
      params: {
        page: page,
        page_size: pageSize
      }
    });
    
    // Convert each item to a SoulId instance
    const soulIds = response.data.items.map(item => new SoulId(item));
    
    return {
      ...response.data,
      items: soulIds
    };
  }

  /**
   * Get upload link for file uploads (internal method)
   */
  private async getUploadLink(contentType: string): Promise<UploadResponse> {
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
   * Get available motions for image-to-video generation
   * @returns Array of available Motion objects with id, name, description, and preview_url
   */
  async getMotions(): Promise<Motion[]> {
    const response = await retryWithBackoff(
      () => this.client.get<Motion[]>('/v1/motions'),
      {
        maxRetries: this.config.maxRetries,
        backoff: this.config.retryBackoff,
        maxBackoff: this.config.retryMaxBackoff
      }
    );
    
    return response.data;
  }

  /**
   * Get available Soul styles for text-to-image generation
   * @returns Array of available SoulStyle objects with id, name, description, and preview_url
   */
  async getSoulStyles(): Promise<SoulStyle[]> {
    const response = await retryWithBackoff(
      () => this.client.get<SoulStyle[]>('/v1/text2image/soul-styles'),
      {
        maxRetries: this.config.maxRetries,
        backoff: this.config.retryBackoff,
        maxBackoff: this.config.retryMaxBackoff
      }
    );
    
    return response.data;
  }

  /**
   * Close the client
   */
  close(): void {
    // Cleanup if needed
  }
}
