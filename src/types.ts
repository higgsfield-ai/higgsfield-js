export enum JobStatus {
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NSFW = 'nsfw',
  CANCELED = 'canceled'
}

export interface Result {
  url: string;
  type: string;
}

export type ResultKey = 'raw' | 'min';
export type Results = Record<ResultKey, Result>;

export interface Job {
  id: string;
  status: string;
  results?: Results | null;
}

export interface JobSetData {
  id: string;
  jobs: Job[];
}

export interface GenerateParams {
  [key: string]: any;
}

export interface WebhookPayload {
  url: string;
  secret: string;
}

export interface UploadResponse {
  upload_url: string;
  public_url: string;
}

export interface SoulStyle {
  id: string;
  name: string;
  description: string;
  preview_url: string;
}

export interface Motion {
  id: string;
  name: string;
  description?: string;
  preview_url?: string;
  start_end_frame?: boolean;
}