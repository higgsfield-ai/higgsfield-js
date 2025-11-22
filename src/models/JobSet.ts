import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';
import { TimeoutError } from '../errors';
import { JobStatus, Job, JobSetData, Results } from '../types';

export class JobSet {
  id: string;
  jobs: Job[];

  constructor(data: JobSetData) {
    this.id = data.id;
    this.jobs = data.jobs;
  }

  get isQueued(): boolean {
    return this.checkStatus(JobStatus.QUEUED);
  }

  get isInProgress(): boolean {
    return this.checkStatus(JobStatus.IN_PROGRESS);
  }

  get isCompleted(): boolean {
    return this.checkStatus(JobStatus.COMPLETED);
  }

  get isNsfw(): boolean {
    return this.checkStatus(JobStatus.NSFW);
  }

  get isFailed(): boolean {
    return this.checkStatus(JobStatus.FAILED);
  }

  get isCanceled(): boolean {
    return this.checkStatus(JobStatus.CANCELED);
  }

  get pollingUrl(): string {
    return `/v1/job-sets/${this.id}`;
  }

  private checkStatus(status: JobStatus): boolean {
    return this.jobs.some(job => job.status === status);
  }

  async poll(client: AxiosInstance, config: Config): Promise<void> {
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > config.maxPollTime) {
        throw new TimeoutError(
          `Polling exceeded maximum time of ${config.maxPollTime}ms`
        );
      }

      try {
        const response = await client.get(this.pollingUrl);
        this.jobs = response.data.jobs;

        if (this.isCompleted || this.isNsfw || this.isFailed || this.isCanceled) {
          break;
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 500) {
          // Server error, continue polling
        } else {
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, config.pollInterval));
    }
  }

  /**
   * Poll v2 API endpoint for request status
   * Uses /requests/{request_id}/status endpoint
   */
  async pollV2(client: AxiosInstance, config: Config): Promise<void> {
    const startTime = Date.now();
    const pollingUrl = `/requests/${this.id}/status`;

    while (true) {
      if (Date.now() - startTime > config.maxPollTime) {
        throw new TimeoutError(
          `Polling exceeded maximum time of ${config.maxPollTime}ms`
        );
      }

      try {
        const response = await client.get(pollingUrl);
        
        const v2Response = response.data;
        const status = v2Response.status || 'queued';
        
        // Map v2 response to JobSet format
        // v2 returns: { status, request_id, images: [{url}], video: {url} }
        // JobSet expects: { id, jobs: [{ id, status, results }] }
        
        // Convert images/video to results format
        let results: Results | null = null;
        if (v2Response.images && v2Response.images.length > 0) {
          // Use first image as raw result, and also as min (thumbnail)
          const imageUrl = v2Response.images[0].url;
          results = {
            raw: {
              url: imageUrl,
              type: 'image'
            },
            min: {
              url: imageUrl,
              type: 'image'
            }
          };
        } else if (v2Response.video && v2Response.video.url) {
          const videoUrl = v2Response.video.url;
          results = {
            raw: {
              url: videoUrl,
              type: 'video'
            },
            min: {
              url: videoUrl,
              type: 'video'
            }
          };
        }

        // Update the first job (v2 typically has one job per request)
        if (this.jobs.length > 0) {
          this.jobs[0].status = status;
          this.jobs[0].results = results;
        } else {
          // Create a job if none exists
          this.jobs = [{
            id: v2Response.request_id || this.id,
            status: status,
            results: results
          }];
        }

        // Check if polling should stop
        if (status === 'completed' || status === 'nsfw' || status === 'failed') {
          break;
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 500) {
          // Server error, continue polling
        } else {
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, config.pollInterval));
    }
  }
}