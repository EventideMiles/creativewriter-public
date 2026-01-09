// Provider types
export type ImageProvider = 'openrouter' | 'fal' | 'replicate';

// Model capabilities
export interface ImageModelCapabilities {
  supportsAspectRatio: boolean;
  supportsNegativePrompt: boolean;
  supportsMultipleImages: boolean;
  supportsSeed: boolean;
  supportsGuidanceScale: boolean;
  supportsInferenceSteps: boolean;
  aspectRatios?: string[];
  imageSizes?: string[];
  maxImages?: number;
  maxInferenceSteps?: number;
}

// Unified model interface across providers
export interface ImageGenerationModel {
  id: string;
  name: string;
  description: string;
  provider: ImageProvider;
  capabilities: ImageModelCapabilities;
  pricing?: {
    perImage?: number;
    perMegapixel?: number;
    currency?: string;
  };
  thumbnail?: string;
}

// Provider-agnostic generation request
export interface ImageGenerationRequest {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  imageSize?: string;
  numImages?: number;
  seed?: number;
  guidanceScale?: number;
  inferenceSteps?: number;
  // Safety settings (fal.ai)
  enableSafetyChecker?: boolean;  // Default: true
  safetyTolerance?: '1' | '2' | '3' | '4' | '5';  // 1=strictest, 5=most permissive (Pro models only)
}

// Generated image result
export interface GeneratedImage {
  url: string;
  base64?: string;
  mimeType: string;
  width?: number;
  height?: number;
  index: number;
}

// Generation result
export interface ImageGenerationResult {
  images: GeneratedImage[];
  modelId: string;
  prompt: string;
  seed?: number;
  generatedAt: Date;
}

// Job tracking
export interface ImageGenerationJob {
  id: string;
  modelId: string;
  modelName: string;
  provider: ImageProvider;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  images?: GeneratedImage[];
  error?: string;
  request: ImageGenerationRequest;
}

// Provider interface - each provider must implement this
export interface IImageProvider {
  readonly providerId: ImageProvider;
  readonly displayName: string;

  // Check if provider is configured (has API key, etc.)
  isConfigured(): boolean;

  // Generate image(s) from prompt
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;

  // Get available models for this provider
  getAvailableModels(): Promise<ImageGenerationModel[]>;

  // Get a specific model by ID
  getModel(modelId: string): ImageGenerationModel | undefined;
}

// Model cache entry for localStorage
export interface ModelCacheEntry {
  models: ImageGenerationModel[];
  cachedAt: number;
  ttlMs: number;
}
