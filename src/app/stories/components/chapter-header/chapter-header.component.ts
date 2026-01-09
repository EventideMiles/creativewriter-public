import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonLabel, IonInput, IonNote, IonButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, saveOutline, closeOutline } from 'ionicons/icons';
import { Chapter } from '../../models/story.interface';

export interface ChapterTitleUpdateEvent {
  chapterId: string;
  title: string;
}

@Component({
  selector: 'app-chapter-header',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonLabel, IonInput, IonNote, IonButton, IonIcon
  ],
  templateUrl: './chapter-header.component.html',
  styleUrls: ['./chapter-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChapterHeaderComponent {
  @Input({ required: true }) chapter!: Chapter;
  @Input() saving = false;

  @Output() titleUpdate = new EventEmitter<ChapterTitleUpdateEvent>();

  // Local editing state
  editing = signal(false);
  editValue = signal('');

  constructor() {
    addIcons({ createOutline, saveOutline, closeOutline });
  }

  get sceneCountLabel(): string {
    const count = this.chapter?.scenes?.length || 0;
    return `${count} scene${count === 1 ? '' : 's'}`;
  }

  startEdit(event?: Event): void {
    if (event) event.stopPropagation();
    this.editValue.set(this.chapter.title || '');
    this.editing.set(true);
  }

  cancelEdit(event?: Event): void {
    if (event) event.stopPropagation();
    this.editing.set(false);
    this.editValue.set('');
  }

  saveTitle(event?: Event): void {
    if (event) event.stopPropagation();
    const value = this.editValue().trim();
    if (!value) return;

    this.titleUpdate.emit({
      chapterId: this.chapter.id,
      title: value
    });
    this.editing.set(false);
  }

  onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
      event.preventDefault();
      this.saveTitle();
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  onInputClick(event: Event): void {
    event.stopPropagation();
  }
}
