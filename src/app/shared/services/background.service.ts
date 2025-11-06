import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { SettingsService } from '../../core/services/settings.service';
import { SyncedCustomBackgroundService } from './synced-custom-background.service';

@Injectable({
  providedIn: 'root'
})
export class BackgroundService {
  private settingsService = inject(SettingsService);
  private customBackgroundService = inject(SyncedCustomBackgroundService);

  // Signal for the current background image
  private backgroundImage = signal<string>('none');
  
  // Signal for preview background (for settings page preview)
  private previewBackgroundImage = signal<string | null>(null);

  // Computed background style (uses preview if available, otherwise saved background)
  backgroundStyle = computed(() => {
    const previewImage = this.previewBackgroundImage();
    const savedImage = this.backgroundImage();
    const image = previewImage !== null ? previewImage : savedImage;
    
    if (image === 'none' || !image) {
      return {
        backgroundImage: 'none',
        backgroundColor: '#1a1a1a'
      };
    }
    
    // Handle custom backgrounds
    if (image.startsWith('custom:')) {
      const customId = image.replace('custom:', '');
      const customBg = this.customBackgroundService.backgrounds().find(bg => bg.id === customId);
      
      if (customBg) {
        return {
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${customBg.blobUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          backgroundColor: '#1a1a1a'
        };
      }
    }
    
    // Handle standard backgrounds
    return {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('assets/backgrounds/${image}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      backgroundColor: '#1a1a1a'
    };
  });

  constructor() {
    // Load initial background from settings
    const settings = this.settingsService.getSettings();
    this.backgroundImage.set(settings.appearance.backgroundImage);

    // Subscribe to settings changes
    this.settingsService.settings$.subscribe(settings => {
      this.backgroundImage.set(settings.appearance.backgroundImage);
    });

    // Apply background to body element when it changes
    effect(() => {
      this.applyBackgroundToBody();
    });
    
    // React to custom background changes
    effect(() => {
      // Trigger re-evaluation when custom backgrounds change
      this.customBackgroundService.backgrounds();
      this.applyBackgroundToBody();
    });
  }

  private applyBackgroundToBody(): void {
    const style = this.backgroundStyle();
    const body = document.body;
    const html = document.documentElement;
    const ionApp = document.querySelector('ion-app');
    
    // Apply styles to html, body and ion-app
    const elements = [html, body, ionApp].filter(el => el) as HTMLElement[];
    
    elements.forEach(element => {
      if (style.backgroundImage === 'none') {
        element.style.backgroundImage = 'none';
        element.style.backgroundColor = style.backgroundColor!;
        element.style.backgroundSize = '';
        element.style.backgroundPosition = '';
        element.style.backgroundRepeat = '';
        element.style.backgroundAttachment = '';
      } else {
        element.style.backgroundImage = style.backgroundImage!;
        element.style.backgroundSize = style.backgroundSize!;
        element.style.backgroundPosition = style.backgroundPosition!;
        element.style.backgroundRepeat = style.backgroundRepeat!;
        element.style.backgroundAttachment = style.backgroundAttachment!;
        element.style.backgroundColor = style.backgroundColor!;
      }
    });
  }

  // Get current background image filename
  getCurrentBackground(): string {
    return this.backgroundImage();
  }

  // Set new background image (saves to settings)
  setBackground(filename: string): void {
    this.settingsService.updateAppearanceSettings({
      backgroundImage: filename
    });
  }

  // Set preview background (temporary, for settings preview)
  setPreviewBackground(filename: string | null): void {
    this.previewBackgroundImage.set(filename);
  }

  // Clear preview background (returns to saved background)
  clearPreviewBackground(): void {
    this.previewBackgroundImage.set(null);
  }
}