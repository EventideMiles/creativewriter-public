import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonIcon,
  IonItem,
  IonLabel,
  IonToggle,
  IonTextarea,
  IonRange
} from '@ionic/angular/standalone';
import { NgSelectModule } from '@ng-select/ng-select';
import { addIcons } from 'ionicons';
import { optionsOutline, layersOutline, codeOutline } from 'ionicons/icons';
import { Settings } from '../../core/models/settings.interface';
import { ModelOption } from '../../core/models/model.interface';

@Component({
  selector: 'app-scene-generation-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    IonAccordion,
    IonAccordionGroup,
    IonBadge,
    IonIcon,
    IonItem,
    IonLabel,
    IonToggle,
    IonTextarea,
    IonRange
  ],
  templateUrl: './scene-generation-settings.component.html',
  styleUrls: ['./scene-generation-settings.component.scss']
})
export class SceneGenerationSettingsComponent {
  @Input() settings!: Settings;
  @Input() combinedModels: ModelOption[] = [];
  @Input() loadingModels = false;
  @Input() modelsDisabled = false;

  @Output() settingsChange = new EventEmitter<void>();

  constructor() {
    addIcons({ optionsOutline, layersOutline, codeOutline });
  }

  getActiveContextCount(): number {
    let count = 0;
    if (this.settings.sceneGenerationFromOutline.includeStoryOutline) count++;
    if (this.settings.sceneGenerationFromOutline.includeCodex) count++;
    return count;
  }

  getContextBadgeColor(): string {
    const count = this.getActiveContextCount();
    if (count === 0) return 'medium';
    if (count === 1) return 'primary';
    return 'success';
  }
}
