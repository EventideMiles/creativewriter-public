import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonAccordion, IonAccordionGroup, IonItem, IonLabel,
  IonTextarea, IonChip, IonNote, IonBadge, IonIcon, IonButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  warningOutline, checkmarkCircleOutline, refreshOutline,
  bookmarkOutline, bookOutline, documentsOutline,
  documentTextOutline, gitMergeOutline, listOutline
} from 'ionicons/icons';
import {
  BeatTemplateSections,
  SceneBeatTemplateSections,
  SceneFromOutlineTemplateSections,
  BeatTemplateSectionMeta,
  BEAT_TEMPLATE_SECTION_META,
  SCENE_BEAT_TEMPLATE_SECTION_META,
  SCENE_FROM_OUTLINE_TEMPLATE_SECTION_META,
  DEFAULT_BEAT_TEMPLATE_SECTIONS,
  DEFAULT_SCENE_BEAT_TEMPLATE_SECTIONS,
  DEFAULT_SCENE_FROM_OUTLINE_TEMPLATE_SECTIONS
} from '../../models/story.interface';
import { validateSectionPlaceholders } from '../../../shared/utils/template-migration';

@Component({
  selector: 'app-beat-template-sections',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonAccordion, IonAccordionGroup, IonItem, IonLabel,
    IonTextarea, IonChip, IonNote, IonBadge, IonIcon, IonButton
  ],
  templateUrl: './beat-template-sections.component.html',
  styleUrls: ['./beat-template-sections.component.scss']
})
export class BeatTemplateSectionsComponent implements OnInit, OnChanges {
  /** Current beat type being edited */
  @Input() beatType: 'story' | 'scene' | 'sceneFromOutline' = 'story';

  /** Story beat template sections */
  @Input() sections: BeatTemplateSections = { ...DEFAULT_BEAT_TEMPLATE_SECTIONS };

  /** Scene beat template sections */
  @Input() sceneSections: SceneBeatTemplateSections = { ...DEFAULT_SCENE_BEAT_TEMPLATE_SECTIONS };

  /** Scene from outline template sections */
  @Input() sceneFromOutlineSections: SceneFromOutlineTemplateSections = { ...DEFAULT_SCENE_FROM_OUTLINE_TEMPLATE_SECTIONS };

  /** Emitted when story beat sections change */
  @Output() sectionsChange = new EventEmitter<BeatTemplateSections>();

  /** Emitted when scene beat sections change */
  @Output() sceneSectionsChange = new EventEmitter<SceneBeatTemplateSections>();

  /** Emitted when scene from outline sections change */
  @Output() sceneFromOutlineSectionsChange = new EventEmitter<SceneFromOutlineTemplateSections>();

  /** Section metadata for current beat type */
  sectionMeta: BeatTemplateSectionMeta[] = [];

  /** Currently expanded accordions */
  expandedAccordions: string[] = ['objective'];

  constructor() {
    addIcons({
      warningOutline, checkmarkCircleOutline, refreshOutline,
      bookmarkOutline, bookOutline, documentsOutline,
      documentTextOutline, gitMergeOutline, listOutline
    });
  }

  ngOnInit(): void {
    this.updateSectionMeta();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['beatType']) {
      this.updateSectionMeta();
    }
  }

  /**
   * Update section metadata based on current beat type
   */
  private updateSectionMeta(): void {
    if (this.beatType === 'sceneFromOutline') {
      this.sectionMeta = SCENE_FROM_OUTLINE_TEMPLATE_SECTION_META;
    } else if (this.beatType === 'scene') {
      this.sectionMeta = SCENE_BEAT_TEMPLATE_SECTION_META;
    } else {
      this.sectionMeta = BEAT_TEMPLATE_SECTION_META;
    }
  }

  /**
   * Get the current sections object based on beat type
   */
  get currentSections(): BeatTemplateSections | SceneBeatTemplateSections | SceneFromOutlineTemplateSections {
    if (this.beatType === 'sceneFromOutline') return this.sceneFromOutlineSections;
    return this.beatType === 'scene' ? this.sceneSections : this.sections;
  }

  /**
   * Get section value by key
   */
  getSectionValue(key: string): string {
    const sections = this.currentSections as unknown as Record<string, string>;
    return sections[key] || '';
  }

  /**
   * Update section value
   */
  onSectionChange(key: string, value: string): void {
    if (this.beatType === 'sceneFromOutline') {
      const updated = { ...this.sceneFromOutlineSections, [key]: value };
      this.sceneFromOutlineSections = updated;
      this.sceneFromOutlineSectionsChange.emit(updated);
    } else if (this.beatType === 'scene') {
      const updated = { ...this.sceneSections, [key]: value };
      this.sceneSections = updated;
      this.sceneSectionsChange.emit(updated);
    } else {
      const updated = { ...this.sections, [key]: value };
      this.sections = updated;
      this.sectionsChange.emit(updated);
    }
  }

  /**
   * Get missing placeholders for a section
   */
  getMissingPlaceholders(meta: BeatTemplateSectionMeta): string[] {
    const value = this.getSectionValue(meta.key);
    return validateSectionPlaceholders(meta.key, value, meta.placeholders);
  }

  /**
   * Check if a section has validation errors
   */
  hasValidationError(meta: BeatTemplateSectionMeta): boolean {
    if (!meta.required && meta.placeholders.length === 0) {
      return false;
    }
    return this.getMissingPlaceholders(meta).length > 0;
  }

  /**
   * Get character count for a section
   */
  getCharacterCount(key: string): number {
    return this.getSectionValue(key).length;
  }

  /**
   * Reset a section to its default value
   */
  resetSection(key: string): void {
    let defaults: Record<string, string>;
    if (this.beatType === 'sceneFromOutline') {
      defaults = DEFAULT_SCENE_FROM_OUTLINE_TEMPLATE_SECTIONS as unknown as Record<string, string>;
    } else if (this.beatType === 'scene') {
      defaults = DEFAULT_SCENE_BEAT_TEMPLATE_SECTIONS as unknown as Record<string, string>;
    } else {
      defaults = DEFAULT_BEAT_TEMPLATE_SECTIONS as unknown as Record<string, string>;
    }
    const defaultValue = defaults[key] || '';
    this.onSectionChange(key, defaultValue);
  }

  /**
   * Reset all sections to defaults
   */
  resetAllSections(): void {
    if (this.beatType === 'sceneFromOutline') {
      this.sceneFromOutlineSections = { ...DEFAULT_SCENE_FROM_OUTLINE_TEMPLATE_SECTIONS };
      this.sceneFromOutlineSectionsChange.emit(this.sceneFromOutlineSections);
    } else if (this.beatType === 'scene') {
      this.sceneSections = { ...DEFAULT_SCENE_BEAT_TEMPLATE_SECTIONS };
      this.sceneSectionsChange.emit(this.sceneSections);
    } else {
      this.sections = { ...DEFAULT_BEAT_TEMPLATE_SECTIONS };
      this.sectionsChange.emit(this.sections);
    }
  }

  /**
   * Track accordion expansion
   */
  onAccordionChange(event: CustomEvent): void {
    this.expandedAccordions = event.detail.value || [];
  }
}
