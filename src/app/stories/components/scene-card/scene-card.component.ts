import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonTextarea, IonInput, IonBadge, IonNote,
  IonButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline, saveOutline, closeOutline, sparklesOutline, syncOutline
} from 'ionicons/icons';
import { Scene } from '../../models/story.interface';

export interface SceneUpdateEvent {
  sceneId: string;
  chapterId: string;
  field: 'title' | 'summary';
  value: string;
}

export interface SceneAIGenerateEvent {
  sceneId: string;
  chapterId: string;
  type: 'title' | 'summary';
}

export interface SceneNavigateEvent {
  sceneId: string;
  chapterId: string;
}

@Component({
  selector: 'app-scene-card',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonTextarea, IonInput, IonBadge, IonNote,
    IonButton, IonIcon
  ],
  templateUrl: './scene-card.component.html',
  styleUrls: ['./scene-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SceneCardComponent {
  @Input({ required: true }) scene!: Scene;
  @Input({ required: true }) chapterId!: string;
  @Input() wordCount = 0;
  @Input() selectedModel = '';
  @Input() generatingSummary = false;
  @Input() generatingTitle = false;
  @Input() savingSummary = false;
  @Input() savingTitle = false;

  @Output() update = new EventEmitter<SceneUpdateEvent>();
  @Output() generateAI = new EventEmitter<SceneAIGenerateEvent>();
  @Output() openScene = new EventEmitter<SceneNavigateEvent>();

  // Local editing state
  editingTitle = signal(false);
  editingSummary = signal(false);
  editTitleValue = signal('');
  editSummaryValue = signal('');

  // Computed word count for summary editing
  editSummaryWordCount = computed(() => {
    const text = this.editSummaryValue().trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  });

  // Getter for disabling AI buttons
  get canGenerateAI(): boolean {
    return !!this.selectedModel && !!this.scene?.content?.trim();
  }

  constructor() {
    addIcons({
      createOutline, saveOutline, closeOutline, sparklesOutline, syncOutline
    });
  }

  get wordCountLabel(): string {
    const count = this.wordCount;
    const noun = count === 1 ? 'word' : 'words';
    return `${count} ${noun}`;
  }

  // Title editing
  startEditTitle(): void {
    this.editTitleValue.set(this.scene.title || '');
    this.editingTitle.set(true);
  }

  cancelEditTitle(): void {
    this.editingTitle.set(false);
    this.editTitleValue.set('');
  }

  saveTitle(): void {
    const value = this.editTitleValue().trim();
    if (!value) return;

    this.update.emit({
      sceneId: this.scene.id,
      chapterId: this.chapterId,
      field: 'title',
      value
    });
    this.editingTitle.set(false);
  }

  onTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
      event.preventDefault();
      this.saveTitle();
    } else if (event.key === 'Escape') {
      this.cancelEditTitle();
    }
  }

  // Summary editing
  startEditSummary(): void {
    this.editSummaryValue.set(this.scene.summary || '');
    this.editingSummary.set(true);
  }

  cancelEditSummary(): void {
    this.editingSummary.set(false);
    this.editSummaryValue.set('');
  }

  saveSummary(): void {
    this.update.emit({
      sceneId: this.scene.id,
      chapterId: this.chapterId,
      field: 'summary',
      value: this.editSummaryValue()
    });
    this.editingSummary.set(false);
  }

  onSummaryKeydown(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === 'NumpadEnter') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.saveSummary();
    } else if (event.key === 'Escape') {
      this.cancelEditSummary();
    }
  }

  // AI generation
  generateTitle(): void {
    this.generateAI.emit({
      sceneId: this.scene.id,
      chapterId: this.chapterId,
      type: 'title'
    });
  }

  generateSummary(): void {
    this.generateAI.emit({
      sceneId: this.scene.id,
      chapterId: this.chapterId,
      type: 'summary'
    });
  }

}
