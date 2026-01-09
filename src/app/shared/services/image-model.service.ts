import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ImageGenerationModel,
  ImageProvider,
  ModelCacheEntry
} from './image-providers/image-provider.interface';
import { OpenRouterImageProvider } from './image-providers/openrouter-image.provider';
import { FalImageProvider } from './image-providers/fal-image.provider';
import { ReplicateImageProvider } from './image-providers/replicate-image.provider';

@Injectable({
  providedIn: 'root'
})
export class ImageModelService {
  private openRouterProvider = inject(OpenRouterImageProvider);
  private falProvider = inject(FalImageProvider);
  private replicateProvider = inject(ReplicateImageProvider);

  private readonly CACHE_KEY = 'creative-writer-image-models-cache';
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_MODEL_NAME_LENGTH = 35;

  private modelsSubject = new BehaviorSubject<ImageGenerationModel[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public models$ = this.modelsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  // Models grouped by provider
  public modelsByProvider$ = this.models$.pipe(
    map(models => {
      const grouped: Record<ImageProvider, ImageGenerationModel[]> = {
        openrouter: [],
        fal: [],
        replicate: []
      };
      for (const model of models) {
        grouped[model.provider].push(model);
      }
      return grouped;
    })
  );

  constructor() {
    // Load cached models on init
    this.loadFromCache();
  }

  /**
   * Load models from all configured providers
   */
  async loadAllModels(forceRefresh = false): Promise<void> {
    if (this.loadingSubject.value) {
      return; // Already loading
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && this.isCacheValid()) {
      return;
    }

    this.loadingSubject.next(true);

    try {
      const allModels: ImageGenerationModel[] = [];

      // Load from each provider in parallel
      const [openRouterModels, falModels, replicateModels] = await Promise.all([
        this.openRouterProvider.getAvailableModels().catch(err => {
          console.warn('Failed to load OpenRouter models:', err);
          return [];
        }),
        this.falProvider.getAvailableModels().catch(err => {
          console.warn('Failed to load fal.ai models:', err);
          return [];
        }),
        this.replicateProvider.getAvailableModels().catch(err => {
          console.warn('Failed to load Replicate models:', err);
          return [];
        })
      ]);

      allModels.push(...openRouterModels, ...falModels, ...replicateModels);

      // Truncate long model names for display
      const truncatedModels = allModels.map(m => this.truncateModelName(m));

      this.modelsSubject.next(truncatedModels);
      this.saveToCache(truncatedModels);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Load models for a specific provider only
   */
  async loadProviderModels(provider: ImageProvider, forceRefresh = false): Promise<ImageGenerationModel[]> {
    const providerInstance = this.getProviderInstance(provider);
    if (!providerInstance) {
      return [];
    }

    if (forceRefresh) {
      providerInstance.clearModelsCache();
    }

    try {
      const models = await providerInstance.getAvailableModels();

      // Truncate long model names for display
      const truncatedModels = models.map(m => this.truncateModelName(m));

      // Update the combined models list
      const currentModels = this.modelsSubject.value.filter(m => m.provider !== provider);
      const allModels = [...currentModels, ...truncatedModels];
      this.modelsSubject.next(allModels);
      this.saveToCache(allModels);

      return truncatedModels;
    } catch (error) {
      console.error(`Failed to load ${provider} models:`, error);
      return [];
    }
  }

  /**
   * Get all loaded models
   */
  getModels(): ImageGenerationModel[] {
    return this.modelsSubject.value;
  }

  /**
   * Get models for a specific provider
   */
  getModelsByProvider(provider: ImageProvider): ImageGenerationModel[] {
    return this.modelsSubject.value.filter(m => m.provider === provider);
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): ImageGenerationModel | undefined {
    return this.modelsSubject.value.find(m => m.id === modelId);
  }

  /**
   * Get a model by ID from a specific provider
   */
  getModelFromProvider(modelId: string, provider: ImageProvider): ImageGenerationModel | undefined {
    const providerInstance = this.getProviderInstance(provider);
    return providerInstance?.getModel(modelId);
  }

  /**
   * Search models by name or description
   */
  searchModels(query: string): ImageGenerationModel[] {
    const lowerQuery = query.toLowerCase();
    return this.modelsSubject.value.filter(m =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery) ||
      m.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Check which providers are configured
   */
  getConfiguredProviders(): ImageProvider[] {
    const configured: ImageProvider[] = [];

    if (this.openRouterProvider.isConfigured()) {
      configured.push('openrouter');
    }
    if (this.falProvider.isConfigured()) {
      configured.push('fal');
    }
    if (this.replicateProvider.isConfigured()) {
      configured.push('replicate');
    }

    return configured;
  }

  /**
   * Check if a specific provider is configured
   */
  isProviderConfigured(provider: ImageProvider): boolean {
    const providerInstance = this.getProviderInstance(provider);
    return providerInstance?.isConfigured() ?? false;
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider: ImageProvider): string {
    const names: Record<ImageProvider, string> = {
      openrouter: 'OpenRouter',
      fal: 'fal.ai',
      replicate: 'Replicate'
    };
    return names[provider];
  }

  /**
   * Clear all cached models and reload
   */
  async refreshAllModels(): Promise<void> {
    this.clearCache();
    this.openRouterProvider.clearModelsCache();
    this.falProvider.clearModelsCache();
    this.replicateProvider.clearModelsCache();
    await this.loadAllModels(true);
  }

  // Private methods

  private getProviderInstance(provider: ImageProvider) {
    switch (provider) {
      case 'openrouter':
        return this.openRouterProvider;
      case 'fal':
        return this.falProvider;
      case 'replicate':
        return this.replicateProvider;
      default:
        return null;
    }
  }

  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const entry: ModelCacheEntry = JSON.parse(cached);
        if (Date.now() - entry.cachedAt < entry.ttlMs) {
          this.modelsSubject.next(entry.models);
        } else {
          // Cache expired, load fresh
          this.loadAllModels();
        }
      } else {
        // No cache, load fresh
        this.loadAllModels();
      }
    } catch (error) {
      console.warn('Failed to load models from cache:', error);
      this.loadAllModels();
    }
  }

  private saveToCache(models: ImageGenerationModel[]): void {
    try {
      const entry: ModelCacheEntry = {
        models,
        cachedAt: Date.now(),
        ttlMs: this.CACHE_TTL_MS
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to save models to cache:', error);
    }
  }

  private isCacheValid(): boolean {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const entry: ModelCacheEntry = JSON.parse(cached);
        return Date.now() - entry.cachedAt < entry.ttlMs;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }

  private clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.warn('Failed to clear models cache:', error);
    }
  }

  /**
   * Truncate model name if too long for display
   */
  private truncateModelName(model: ImageGenerationModel): ImageGenerationModel {
    if (model.name.length <= this.MAX_MODEL_NAME_LENGTH) {
      return model;
    }
    return {
      ...model,
      name: model.name.substring(0, this.MAX_MODEL_NAME_LENGTH - 3) + '...'
    };
  }
}
