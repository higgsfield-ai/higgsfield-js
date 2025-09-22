import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';
import { TimeoutError } from '../errors';
import { JobStatus, Job, JobSetData } from '../types';

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
}
