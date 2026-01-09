// Re-export all types from the provider interface
export type {
  ImageProvider,
  ImageModelCapabilities,
  ImageGenerationModel,
  ImageGenerationRequest,
  GeneratedImage,
  ImageGenerationResult,
  ImageGenerationJob,
  IImageProvider,
  ModelCacheEntry
} from '../services/image-providers/image-provider.interface';

// Legacy interfaces for backward compatibility with old code
// These can be removed once all components are updated

/**
 * @deprecated Use ImageGenerationModel from image-provider.interface instead
 */
export interface LegacyImageGenerationModel {
  id: string;
  name: string;
  description: string;
  version: string;
  owner: string;
  inputs: ModelInput[];
  maxBatchSize?: number;
}

/**
 * @deprecated Use ImageModelCapabilities instead
 */
export interface ModelInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'integer' | 'file' | 'array';
  description: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  options?: string[];
  required?: boolean;
}

/**
 * @deprecated Use ImageGenerationRequest from image-provider.interface instead
 */
export interface LegacyImageGenerationRequest {
  version: string;
  input: Record<string, unknown>;
}

/**
 * @deprecated Use ImageGenerationResult from image-provider.interface instead
 */
export interface ImageGenerationResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
  logs?: string;
  metrics?: {
    predict_time?: number;
  };
}

/**
 * @deprecated Use ImageGenerationJob from image-provider.interface instead
 */
export interface LegacyImageGenerationJob {
  id: string;
  model: string;
  prompt: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  imageUrl?: string;
  imageUrls?: string[];
  error?: string;
}
