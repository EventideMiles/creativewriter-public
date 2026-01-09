import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { getProviderIcon, getProviderColor, getProviderTooltip } from '../../../core/provider-icons';

/**
 * Unified provider icon component
 * Replaces individual icon components (OpenRouterIconComponent, ClaudeIconComponent, etc.)
 * Usage: <app-provider-icon [provider]="'openrouter'" [size]="20"></app-provider-icon>
 */
@Component({
  selector: 'app-provider-icon',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <ion-icon
      [name]="iconName"
      [style.color]="useColor ? iconColor : null"
      [style.font-size.px]="size"
      [style.width.px]="size"
      [style.height.px]="size"
      [title]="showTooltip ? tooltip : null">
    </ion-icon>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    ion-icon {
      display: block;
    }
  `]
})
export class ProviderIconComponent {
  /** Provider identifier (e.g., 'openrouter', 'claude', 'ollama') */
  @Input() provider!: string;

  /** Icon size in pixels */
  @Input() size = 16;

  /** Whether to apply the provider's brand color */
  @Input() useColor = true;

  /** Whether to show the provider tooltip on hover */
  @Input() showTooltip = false;

  get iconName(): string {
    return getProviderIcon(this.provider);
  }

  get iconColor(): string {
    return getProviderColor(this.provider);
  }

  get tooltip(): string {
    return getProviderTooltip(this.provider);
  }
}
