import { Injectable, inject } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { Story, Chapter, Scene } from '../models/story.interface';
import { Codex, CodexCategory, CodexEntry, PortraitGalleryItem } from '../models/codex.interface';
import { StoryService } from './story.service';
import { CodexService } from './codex.service';
import { DatabaseBackupService } from '../../shared/services/database-backup.service';
import { DatabaseService } from '../../core/services/database.service';

export interface StoryExportData {
  version: number;
  exportDate: string;
  story: Story;
  codex?: Codex;
  metadata: {
    appVersion: string;
    originalStoryId: string;
    originalCodexId?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ImportResult {
  storyId: string;
  codexId?: string;
  finalTitle: string;
}

@Injectable({
  providedIn: 'root'
})
export class StoryExportImportService {
  private readonly storyService = inject(StoryService);
  private readonly codexService = inject(CodexService);
  private readonly databaseBackupService = inject(DatabaseBackupService);
  private readonly databaseService = inject(DatabaseService);

  private readonly CURRENT_VERSION = 1;
  private readonly APP_VERSION = '1.0.0';
  private readonly MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  /**
   * Export a story with its codex to JSON string
   */
  async exportStory(storyId: string): Promise<string> {
    // Get the story
    const story = await this.storyService.getStory(storyId);
    if (!story) {
      throw new Error('Story not found');
    }

    // Get the codex if it exists
    const codex = this.codexService.getCodex(storyId);

    // Create export data
    const exportData: StoryExportData = {
      version: this.CURRENT_VERSION,
      exportDate: new Date().toISOString(),
      story: this.cleanStoryForExport(story),
      codex: codex ? this.cleanCodexForExport(codex) : undefined,
      metadata: {
        appVersion: this.APP_VERSION,
        originalStoryId: story.id,
        originalCodexId: codex?.id
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Validate import data structure
   */
  validateImportData(jsonData: string): ValidationResult {
    const errors: string[] = [];

    try {
      const data = JSON.parse(jsonData);

      // Check version
      if (typeof data.version !== 'number') {
        errors.push('Missing or invalid version field');
      } else if (data.version > this.CURRENT_VERSION) {
        errors.push(`Unsupported version ${data.version}. Maximum supported: ${this.CURRENT_VERSION}`);
      }

      // Check story
      if (!data.story) {
        errors.push('Missing story data');
      } else {
        if (!data.story.title) {
          errors.push('Story is missing title');
        }
        if (!Array.isArray(data.story.chapters)) {
          errors.push('Story is missing chapters array');
        }
      }

      // Check metadata
      if (!data.metadata) {
        errors.push('Missing metadata');
      }

    } catch {
      errors.push('Invalid JSON format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse import data for preview (without saving)
   */
  parseImportData(jsonData: string): StoryExportData {
    const validation = this.validateImportData(jsonData);
    if (!validation.valid) {
      throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);
    }

    return JSON.parse(jsonData) as StoryExportData;
  }

  /**
   * Import a story from JSON data
   */
  async importStory(jsonData: string): Promise<ImportResult> {
    const exportData = this.parseImportData(jsonData);

    // Regenerate all IDs
    const newStoryId = uuidv4();
    const story = this.regenerateStoryIds(exportData.story, newStoryId);

    // Ensure unique title
    story.title = await this.ensureUniqueTitle(story.title);

    // Reset timestamps
    const now = new Date();
    story.createdAt = now;
    story.updatedAt = now;

    // Remove PouchDB-specific fields
    delete story._rev;
    story._id = newStoryId;

    // Save the story
    await this.saveImportedStory(story);

    let codexId: string | undefined;

    // Import codex if present
    if (exportData.codex) {
      const newCodexId = uuidv4();
      const codex = this.regenerateCodexIds(exportData.codex, newStoryId, newCodexId);
      codex.createdAt = now;
      codex.updatedAt = now;

      await this.saveImportedCodex(codex, newStoryId);
      codexId = newCodexId;

      // Update story with codex reference
      story.codexId = newCodexId;
      await this.storyService.updateStory(story);
    }

    return {
      storyId: newStoryId,
      codexId,
      finalTitle: story.title
    };
  }

  /**
   * Download the export file
   */
  downloadExport(jsonData: string, storyTitle: string): void {
    const safeTitle = storyTitle
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${safeTitle}-export-${timestamp}.json`;

    this.databaseBackupService.downloadFile(jsonData, filename, 'application/json');
  }

  /**
   * Remove PouchDB-specific fields for clean export
   */
  private cleanStoryForExport(story: Story): Story {
    const cleaned = { ...story };
    delete cleaned._rev;
    delete cleaned._id;
    return cleaned;
  }

  /**
   * Remove PouchDB-specific fields from codex
   */
  private cleanCodexForExport(codex: Codex): Codex {
    return { ...codex };
  }

  /**
   * Regenerate all IDs in a story
   */
  private regenerateStoryIds(story: Story, newStoryId: string): Story {
    const idMap = new Map<string, string>();

    const newStory: Story = {
      ...story,
      id: newStoryId,
      _id: newStoryId,
      chapters: story.chapters.map(chapter => {
        const newChapterId = uuidv4();
        idMap.set(chapter.id, newChapterId);

        return {
          ...chapter,
          id: newChapterId,
          scenes: chapter.scenes.map(scene => {
            const newSceneId = uuidv4();
            idMap.set(scene.id, newSceneId);

            // Regenerate beat IDs in content
            const newContent = this.regenerateBeatIds(scene.content);

            return {
              ...scene,
              id: newSceneId,
              content: newContent,
              createdAt: this.safeParseDate(scene.createdAt),
              updatedAt: this.safeParseDate(scene.updatedAt)
            } as Scene;
          }),
          createdAt: this.safeParseDate(chapter.createdAt),
          updatedAt: this.safeParseDate(chapter.updatedAt)
        } as Chapter;
      }),
      createdAt: this.safeParseDate(story.createdAt),
      updatedAt: this.safeParseDate(story.updatedAt)
    };

    // Clear lastModifiedBy as this is a new import
    delete newStory.lastModifiedBy;

    return newStory;
  }

  /**
   * Regenerate beat IDs in scene content HTML
   */
  private regenerateBeatIds(content: string): string {
    if (!content) return content;

    // Match data-beat-id="..." and replace with new UUIDs
    return content.replace(/data-beat-id="[^"]+"/g, () => {
      return `data-beat-id="${uuidv4()}"`;
    });
  }

  /**
   * Regenerate all IDs in a codex
   */
  private regenerateCodexIds(codex: Codex, newStoryId: string, newCodexId: string): Codex {
    return {
      ...codex,
      id: newCodexId,
      storyId: newStoryId,
      categories: codex.categories.map(category => {
        const newCategoryId = uuidv4();

        return {
          ...category,
          id: newCategoryId,
          entries: category.entries.map(entry => {
            const newEntryId = uuidv4();

            return {
              ...entry,
              id: newEntryId,
              categoryId: newCategoryId,
              // Regenerate portrait gallery IDs if present
              portraitGallery: entry.portraitGallery?.map((portrait: PortraitGalleryItem) => ({
                ...portrait,
                id: uuidv4(),
                createdAt: this.safeParseDate(portrait.createdAt)
              })),
              createdAt: this.safeParseDate(entry.createdAt),
              updatedAt: this.safeParseDate(entry.updatedAt)
            } as CodexEntry;
          }),
          createdAt: this.safeParseDate(category.createdAt),
          updatedAt: this.safeParseDate(category.updatedAt)
        } as CodexCategory;
      }),
      createdAt: this.safeParseDate(codex.createdAt),
      updatedAt: this.safeParseDate(codex.updatedAt)
    };
  }

  /**
   * Ensure the story title is unique by appending " (imported)" if needed
   */
  private async ensureUniqueTitle(title: string): Promise<string> {
    const allStories = await this.storyService.getAllStories();
    const existingTitles = new Set(allStories.map(s => s.title.toLowerCase()));

    let newTitle = title;
    let counter = 0;

    while (existingTitles.has(newTitle.toLowerCase())) {
      counter++;
      newTitle = counter === 1
        ? `${title} (imported)`
        : `${title} (imported ${counter})`;
    }

    return newTitle;
  }

  /**
   * Save imported story directly to database using db.put()
   */
  private async saveImportedStory(story: Story): Promise<void> {
    const db = await this.databaseService.getDatabase();
    // Ensure schema version is set
    if (!story.schemaVersion) {
      story.schemaVersion = 1;
    }
    // Insert directly into database (not update - this is a new document)
    await db.put(story);
  }

  /**
   * Save imported codex directly to database
   */
  private async saveImportedCodex(codex: Codex, storyId: string): Promise<void> {
    const db = await this.databaseService.getDatabase();

    // Create the codex document with PouchDB _id
    const codexDoc = {
      ...codex,
      _id: `codex_${storyId}`,
      type: 'codex' as const
    };

    // Insert directly into database
    await db.put(codexDoc);

    // Update the in-memory cache in CodexService
    this.codexService.setCodexCache(storyId, codex);
  }

  /**
   * Get the maximum allowed import file size
   */
  getMaxImportFileSize(): number {
    return this.MAX_IMPORT_FILE_SIZE;
  }

  /**
   * Helper to safely parse dates, returning current date if invalid
   */
  private safeParseDate(dateValue: Date | string | undefined): Date {
    if (!dateValue) return new Date();
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
