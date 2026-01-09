import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonTextarea, IonIcon,
  IonRange, IonToggle, IonFooter,
  ToastController
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, sparklesOutline, sendOutline } from 'ionicons/icons';
import { ModelSelectorComponent } from '../../../shared/components/model-selector/model-selector.component';
import { SettingsService } from '../../../core/services/settings.service';
import { StoryService } from '../../services/story.service';
import { SceneGenerationService } from '../../../shared/services/scene-generation.service';

@Component({
  selector: 'app-scene-create-from-outline',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonItem, IonLabel, IonTextarea, IonIcon,
    IonRange, IonToggle, IonFooter,
    ModelSelectorComponent
  ],
  templateUrl: './scene-create-from-outline.component.html',
  styleUrls: ['./scene-create-from-outline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SceneCreateFromOutlineComponent {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private settingsService = inject(SettingsService);
  private storyService = inject(StoryService);
  private sceneGenService = inject(SceneGenerationService);

  @Input() storyId!: string;
  @Input() chapterId!: string;

  outline = '';
  selectedModel = '';
  wordCount = 600;
  includeStoryOutline = true;
  useFullStoryContext = false; // false => summaries
  includeCodex = false;
  temperature = 0.7;
  error: string | null = null;

  constructor() {
    addIcons({ closeOutline, sparklesOutline, sendOutline });
    const s = this.settingsService.getSettings();
    this.temperature = s.sceneGenerationFromOutline?.temperature ?? s.openRouter?.temperature ?? 0.7;
    this.wordCount = s.sceneGenerationFromOutline?.wordCount ?? 600;
    this.includeStoryOutline = s.sceneGenerationFromOutline?.includeStoryOutline ?? true;
    this.useFullStoryContext = s.sceneGenerationFromOutline?.useFullStoryContext ?? false;
    this.includeCodex = s.sceneGenerationFromOutline?.includeCodex ?? false;
    this.selectedModel = s.sceneGenerationFromOutline?.selectedModel || '';
    // If no specific model, ModelSelectorComponent will fallback to global selectedModel
  }

  async create(): Promise<void> {
    this.error = null;
    if (!this.outline || this.outline.trim().length < 5) {
      this.error = 'Please provide a brief outline (at least a few words).';
      return;
    }
    if (!this.selectedModel) {
      this.error = 'Please select an AI model.';
      return;
    }

    try {
      // 1) Create placeholder scene first to obtain sceneId/order
      const newScene = await this.storyService.addScene(this.storyId, this.chapterId);

      // 2) Start generation in background (don't await)
      this.sceneGenService.generateFromOutline({
        storyId: this.storyId,
        chapterId: this.chapterId,
        sceneId: newScene.id,
        outline: this.outline,
        model: this.selectedModel,
        wordCount: this.wordCount,
        includeStoryOutline: this.includeStoryOutline,
        useFullStoryContext: this.useFullStoryContext,
        includeCodex: this.includeCodex,
        temperature: this.temperature
      }).then(async () => {
        // Generation completed successfully
        const toast = await this.toastCtrl.create({
          message: 'Scene generated successfully!',
          duration: 4000,
          color: 'success',
          position: 'bottom',
          buttons: [{ text: 'Dismiss', role: 'cancel' }]
        });
        await toast.present();
      }).catch(async (error) => {
        // Generation failed
        const message = error instanceof Error ? error.message : 'Generation failed';
        const toast = await this.toastCtrl.create({
          message: `Scene generation failed: ${message}`,
          duration: 5000,
          color: 'danger',
          position: 'bottom',
          buttons: [{ text: 'Dismiss', role: 'cancel' }]
        });
        await toast.present();

        // Delete the placeholder scene on error
        try {
          await this.storyService.deleteScene(this.storyId, this.chapterId, newScene.id);
        } catch (deleteErr) {
          console.warn('Failed to delete placeholder scene after error:', deleteErr);
        }
      });

      // 3) Close modal immediately
      await this.modalCtrl.dismiss({ createdSceneId: newScene.id, chapterId: this.chapterId });

      // 4) Show "started" toast
      const toast = await this.toastCtrl.create({
        message: 'Scene generation started...',
        duration: 3000,
        color: 'primary',
        position: 'bottom'
      });
      await toast.present();

    } catch (e: unknown) {
      console.error('Failed to start scene generation:', e);
      const message = typeof e === 'object' && e && 'message' in e ? String((e as { message?: unknown }).message) : undefined;
      this.error = message || 'Failed to start generation.';
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  // Language is derived in the service from story settings
}
