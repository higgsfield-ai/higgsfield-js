import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';
import { TimeoutError } from '../errors';
import { SoulIdData, SoulIdStatus } from '../types';

export class SoulId {
  id: string;
  status: SoulIdStatus;
  name: string;

  constructor(data: SoulIdData) {
    this.id = data.id;
    this.name = data.name;
    this.status = data.status;
  }

  get pollingUrl(): string {
    return `/v1/custom-references/${this.id}`;
  }

  get isCompleted(): boolean {
    return this.status == SoulIdStatus.COMPLETED;
  }

  get isFailed(): boolean {
    return this.status == SoulIdStatus.FAILED;
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
        this.status = response.data.status;

        if (this.isCompleted || this.isFailed) {
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