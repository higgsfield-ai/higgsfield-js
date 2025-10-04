export enum JobStatus {
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NSFW = 'nsfw',
  CANCELED = 'canceled'
}

export enum SoulIdStatus {
  NOT_READY = 'not_ready',
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum InputImageType {
  IMAGE_URL = 'image_url'
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

export interface SoulIdData {
  id: string;
  name: string;
  status: SoulIdStatus;
}

export interface InputImageData {
  type: InputImageType
  image_url: string;
}

export interface SoulIdCreateData {
  name: string;
  input_images: InputImageData[];
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

export interface SoulIdListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: SoulIdData[];
}