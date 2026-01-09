/**
 * Centralized provider icon configuration
 * Single source of truth for all AI provider icons, colors, and tooltips
 */

export interface ProviderIconConfig {
  iconName: string;
  color: string;
  tooltip: string;
}

export const PROVIDER_ICONS: Record<string, ProviderIconConfig> = {
  openrouter: {
    iconName: 'openrouter-custom',
    color: '#6467f2',
    tooltip: 'OpenRouter - Unified API gateway for multiple AI models'
  },
  claude: {
    iconName: 'claude-custom',
    color: '#C15F3C',
    tooltip: 'Claude - Anthropic\'s helpful, harmless, and honest AI assistant'
  },
  ollama: {
    iconName: 'ollama-custom',
    color: '#ff9800',
    tooltip: 'Ollama - Run large language models locally on your machine'
  },
  replicate: {
    iconName: 'replicate-custom',
    color: '#9c27b0',
    tooltip: 'Replicate - Cloud platform for running machine learning models'
  },
  fal: {
    iconName: 'fal-custom',
    color: '#a855f7',
    tooltip: 'fal.ai - Fast inference for generative AI'
  },
  gemini: {
    iconName: 'logo-google',
    color: '#4285f4',
    tooltip: 'Google Gemini - Advanced multimodal AI from Google'
  },
  grok: {
    iconName: 'sparkles-outline',
    color: '#1DA1F2',
    tooltip: 'Grok - xAI\'s conversational AI'
  },
  openaiCompatible: {
    iconName: 'server-outline',
    color: '#4caf50',
    tooltip: 'OpenAI-Compatible - Local server with OpenAI API (LM Studio, LocalAI, etc.)'
  }
};

/**
 * Get the icon name for a provider
 */
export function getProviderIcon(provider: string): string {
  return PROVIDER_ICONS[provider]?.iconName ?? 'globe-outline';
}

/**
 * Get the color for a provider
 */
export function getProviderColor(provider: string): string {
  return PROVIDER_ICONS[provider]?.color ?? 'var(--ion-color-medium)';
}

/**
 * Get the tooltip for a provider
 */
export function getProviderTooltip(provider: string): string {
  return PROVIDER_ICONS[provider]?.tooltip ?? 'AI Provider';
}

/**
 * Check if a provider uses a custom icon (vs standard ionicon)
 */
export function isCustomProviderIcon(provider: string): boolean {
  const iconName = PROVIDER_ICONS[provider]?.iconName;
  return iconName?.endsWith('-custom') ?? false;
}
