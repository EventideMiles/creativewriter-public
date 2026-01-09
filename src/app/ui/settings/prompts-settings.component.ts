import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonAccordion, IonAccordionGroup, IonBadge,
  IonItem, IonLabel, IonToggle, IonTextarea, IonButton,
  IonRange, IonSelect, IonSelectOption, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bookmarkOutline, filmOutline, documentTextOutline, syncOutline } from 'ionicons/icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { Settings } from '../../core/models/settings.interface';
import { ModelOption } from '../../core/models/model.interface';
import { PromptTemplateService } from '../../shared/services/prompt-template.service';
import { ModelFavoritesSettingsComponent } from './model-favorites-settings/model-favorites-settings.component';
import { getProviderIcon as getIcon, getProviderTooltip as getTooltip } from '../../core/provider-icons';

@Component({
  selector: 'app-prompts-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule, TitleCasePipe,
    IonAccordion, IonAccordionGroup, IonBadge,
    IonItem, IonLabel, IonToggle, IonTextarea, IonButton,
    IonRange, IonSelect, IonSelectOption, IonIcon,
    ModelFavoritesSettingsComponent
  ],
  templateUrl: './prompts-settings.component.html',
  styleUrls: ['./prompts-settings.component.scss']
})
export class PromptsSettingsComponent {
  @Input() settings!: Settings;
  @Input() combinedModels: ModelOption[] = [];
  @Input() loadingModels = false;
  @Input() modelsDisabled = false;
  @Input() modelLoadError: string | null = null;
  
  @Output() settingsChange = new EventEmitter<void>();
  @Output() rewriteFavoritesChange = new EventEmitter<string[]>();

  private promptTemplateService = inject(PromptTemplateService);

  constructor() {
    addIcons({ bookmarkOutline, filmOutline, documentTextOutline, syncOutline });
  }

  onRewriteFavoritesChange(favoriteIds: string[]): void {
    this.rewriteFavoritesChange.emit(favoriteIds);
  }

  formatContextLength(length: number): string {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(1)}M`;
    } else if (length >= 1000) {
      return `${(length / 1000).toFixed(0)}K`;
    }
    return length.toString();
  }

  getModelDisplayName(modelId: string): string {
    if (!modelId) return 'Global Model';
    
    // Find the model in available models to get its display name
    const model = this.combinedModels.find(m => m.id === modelId);
    if (model) {
      return model.label;
    }
    
    // If not found in available models, try to extract a readable name from the ID
    if (modelId.includes(':')) {
      const parts = modelId.split(':');
      const modelName = parts[1] || modelId;
      return modelName.split('/').pop() || modelName;
    }
    
    return modelId;
  }

  resetToDefaultPrompt(): void {
    const defaultPrompt = 'Create a title for the following scene. The title should be up to {maxWords} words long and capture the essence of the scene.\n\n{styleInstruction}\n{genreInstruction}\n{languageInstruction}{customInstruction}\n\nScene content (only this one scene):\n{sceneContent}\n\nRespond only with the title, without further explanations or quotes.';
    this.settings.sceneTitleGeneration.customPrompt = defaultPrompt;
    this.settingsChange.emit();
  }

  async resetToDefaultSummaryPrompt(): Promise<void> {
    try {
      const template = await this.promptTemplateService.getSceneSummaryTemplate();
      this.settings.sceneSummaryGeneration.customPrompt = template;
    } catch (error) {
      console.error('Failed to load default scene summary prompt template', error);
      const fallback = 'Create a summary of the following scene:\n\nTitle: {sceneTitle}\n\nContent:\n{sceneContent}\n\nWrite a focused, comprehensive summary that captures the most important plot points and character developments.\n\n{languageInstruction}';
      this.settings.sceneSummaryGeneration.customPrompt = fallback;
    }
    this.settingsChange.emit();
  }

  async resetToDefaultStagingNotesPrompt(): Promise<void> {
    try {
      const template = await this.promptTemplateService.getStagingNotesTemplate();
      this.settings.stagingNotesGeneration.customPrompt = template;
    } catch (error) {
      console.error('Failed to load default staging notes prompt template', error);
      const fallback = 'Extract staging notes from the following scene:\n\n{sceneContent}\n\nFocus on character positions, object placements, and environmental details.\n\n{languageInstruction}';
      this.settings.stagingNotesGeneration.customPrompt = fallback;
    }
    this.settingsChange.emit();
  }

  getProviderIcon(provider: string): string {
    return getIcon(provider);
  }

  getProviderTooltip(provider: string): string {
    return getTooltip(provider);
  }
}
