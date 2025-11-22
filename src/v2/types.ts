// Base endpoint input types for known endpoints
export interface DoPImage2VideoInput {
  model: 'dop-lite' | 'dop-turbo' | 'dop-standard';
  prompt: string;
  input_images: Array<{
    type: 'image_url';
    image_url: string;
  }>;
  motions?: Array<{
    id: string;
    strength: number;
  }>;
  seed?: number;
  enhance_prompt?: boolean;
}

export interface SpeakVideoInput {
  input_image: {
    type: 'image_url';
    image_url: string;
  };
  input_audio: {
    type: 'audio_url';
    audio_url: string;
  };
  prompt: string;
  quality: 'mid' | 'high';
  duration: 5 | 10 | 15;
  seed?: number;
}

export interface SoulText2ImageInput {
  prompt: string;
  width_and_height: string;
  quality: '720p' | '1080p';
  batch_size: 1 | 4;
  style_id?: string;
  style_strength?: number;
  custom_reference_id?: string;
  custom_reference_strength?: number;
  image_reference?: {
    type: 'image_url';
    image_url: string;
  };
  enhance_prompt?: boolean;
  seed?: number;
}

// Endpoint to Input Type Mapping for built-in endpoints
export interface EndpointInputMap {
  '/v1/image2video/dop': DoPImage2VideoInput;
  '/v1/speak/higgsfield': SpeakVideoInput;
  '/v1/text2image/soul': SoulText2ImageInput;
}

// Helper type to extract input type from endpoint
export type EndpointInput<TEndpoint extends keyof EndpointInputMap> = 
  EndpointInputMap[TEndpoint];

// Model schema from backend/CMS
export interface ModelSchema {
  endpoint: string;
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ModelSchemasResponse {
  models: ModelSchema[];
}

