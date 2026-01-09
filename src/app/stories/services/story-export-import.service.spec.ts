import { TestBed } from '@angular/core/testing';
import { StoryExportImportService, StoryExportData, ValidationResult } from './story-export-import.service';
import { StoryService } from './story.service';
import { CodexService } from './codex.service';
import { DatabaseBackupService } from '../../shared/services/database-backup.service';
import { DatabaseService } from '../../core/services/database.service';
import { Story } from '../models/story.interface';
import { Codex } from '../models/codex.interface';

describe('StoryExportImportService', () => {
  let service: StoryExportImportService;
  let mockStoryService: jasmine.SpyObj<StoryService>;
  let mockCodexService: jasmine.SpyObj<CodexService>;
  let mockDatabaseBackupService: jasmine.SpyObj<DatabaseBackupService>;
  let mockDatabaseService: jasmine.SpyObj<DatabaseService>;
  let mockDb: jasmine.SpyObj<PouchDB.Database>;

  const mockStory: Story = {
    _id: 'story-123',
    id: 'story-123',
    title: 'Test Story',
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter One',
        order: 1,
        chapterNumber: 1,
        scenes: [
          {
            id: 'scene-1',
            title: 'Scene One',
            content: '<p>Some content</p><div class="beat-ai-node" data-beat-id="beat-1">Beat content</div>',
            order: 1,
            sceneNumber: 1,
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-02')
          }
        ],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02')
      }
    ],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02')
  };

  const mockCodex: Codex = {
    id: 'codex-123',
    storyId: 'story-123',
    title: 'Test Codex',
    categories: [
      {
        id: 'category-1',
        title: 'Characters',
        description: 'Story characters',
        icon: 'person',
        order: 1,
        entries: [
          {
            id: 'entry-1',
            categoryId: 'category-1',
            title: 'Hero',
            content: 'The main character',
            order: 1,
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-02')
          }
        ],
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02')
      }
    ],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02')
  };

  const validExportData: StoryExportData = {
    version: 1,
    exportDate: '2025-01-01T00:00:00.000Z',
    story: mockStory,
    codex: mockCodex,
    metadata: {
      appVersion: '1.0.0',
      originalStoryId: 'story-123',
      originalCodexId: 'codex-123'
    }
  };

  beforeEach(() => {
    // Create mock database
    mockDb = jasmine.createSpyObj('PouchDB.Database', ['get', 'put', 'allDocs']);

    // Create mock services
    mockStoryService = jasmine.createSpyObj('StoryService', ['getStory', 'getAllStories', 'updateStory']);
    mockCodexService = jasmine.createSpyObj('CodexService', ['getCodex', 'setCodexCache']);
    mockDatabaseBackupService = jasmine.createSpyObj('DatabaseBackupService', ['downloadFile']);
    mockDatabaseService = jasmine.createSpyObj('DatabaseService', ['getDatabase']);

    mockDatabaseService.getDatabase.and.returnValue(Promise.resolve(mockDb as unknown as PouchDB.Database));

    TestBed.configureTestingModule({
      providers: [
        StoryExportImportService,
        { provide: StoryService, useValue: mockStoryService },
        { provide: CodexService, useValue: mockCodexService },
        { provide: DatabaseBackupService, useValue: mockDatabaseBackupService },
        { provide: DatabaseService, useValue: mockDatabaseService }
      ]
    });

    service = TestBed.inject(StoryExportImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMaxImportFileSize', () => {
    it('should return 50MB as max file size', () => {
      const maxSize = service.getMaxImportFileSize();
      expect(maxSize).toBe(50 * 1024 * 1024);
    });
  });

  describe('validateImportData', () => {
    it('should return valid for correct export data', () => {
      const jsonData = JSON.stringify(validExportData);
      const result: ValidationResult = service.validateImportData(jsonData);

      expect(result.valid).toBeTrue();
      expect(result.errors.length).toBe(0);
    });

    it('should return invalid for malformed JSON', () => {
      const result = service.validateImportData('not valid json {{{');

      expect(result.valid).toBeFalse();
      expect(result.errors).toContain('Invalid JSON format');
    });

    it('should return invalid for missing version field', () => {
      const dataWithoutVersion = { ...validExportData };
      delete (dataWithoutVersion as Partial<StoryExportData>).version;
      const jsonData = JSON.stringify(dataWithoutVersion);

      const result = service.validateImportData(jsonData);

      expect(result.valid).toBeFalse();
      expect(result.errors).toContain('Missing or invalid version field');
    });

    it('should return invalid for unsupported version', () => {
      const dataWithHighVersion = { ...validExportData, version: 999 };
      const jsonData = JSON.stringify(dataWithHighVersion);

      const result = service.validateImportData(jsonData);

      expect(result.valid).toBeFalse();
      expect(result.errors.some(e => e.includes('Unsupported version'))).toBeTrue();
    });

    it('should return invalid for missing story data', () => {
      const dataWithoutStory = { ...validExportData };
      delete (dataWithoutStory as Partial<StoryExportData>).story;
      const jsonData = JSON.stringify(dataWithoutStory);

      const result = service.validateImportData(jsonData);

      expect(result.valid).toBeFalse();
      expect(result.errors).toContain('Missing story data');
    });

    it('should return invalid for missing story title', () => {
      const dataWithoutTitle = {
        ...validExportData,
        story: { ...validExportData.story, title: '' }
      };
      const jsonData = JSON.stringify(dataWithoutTitle);

      const result = service.validateImportData(jsonData);

      expect(result.valid).toBeFalse();
      expect(result.errors).toContain('Story is missing title');
    });

    it('should return invalid for missing chapters array', () => {
      const dataWithoutChapters = {
        ...validExportData,
        story: { ...validExportData.story, chapters: null }
      };
      const jsonData = JSON.stringify(dataWithoutChapters);

      const result = service.validateImportData(jsonData);

      expect(result.valid).toBeFalse();
      expect(result.errors).toContain('Story is missing chapters array');
    });

    it('should return invalid for missing metadata', () => {
      const dataWithoutMetadata = { ...validExportData };
      delete (dataWithoutMetadata as Partial<StoryExportData>).metadata;
      const jsonData = JSON.stringify(dataWithoutMetadata);

      const result = service.validateImportData(jsonData);

      expect(result.valid).toBeFalse();
      expect(result.errors).toContain('Missing metadata');
    });
  });

  describe('parseImportData', () => {
    it('should parse valid export data', () => {
      const jsonData = JSON.stringify(validExportData);
      const result = service.parseImportData(jsonData);

      expect(result.version).toBe(1);
      expect(result.story.title).toBe('Test Story');
      expect(result.codex?.title).toBe('Test Codex');
    });

    it('should throw error for invalid data', () => {
      expect(() => {
        service.parseImportData('invalid json');
      }).toThrowError(/Invalid import data/);
    });
  });

  describe('exportStory', () => {
    it('should export story with codex', async () => {
      mockStoryService.getStory.and.returnValue(Promise.resolve(mockStory));
      mockCodexService.getCodex.and.returnValue(mockCodex);

      const result = await service.exportStory('story-123');
      const parsed = JSON.parse(result) as StoryExportData;

      expect(parsed.version).toBe(1);
      expect(parsed.story.title).toBe('Test Story');
      expect(parsed.codex).toBeDefined();
      expect(parsed.codex?.title).toBe('Test Codex');
      expect(parsed.metadata.originalStoryId).toBe('story-123');
    });

    it('should export story without codex', async () => {
      mockStoryService.getStory.and.returnValue(Promise.resolve(mockStory));
      mockCodexService.getCodex.and.returnValue(undefined);

      const result = await service.exportStory('story-123');
      const parsed = JSON.parse(result) as StoryExportData;

      expect(parsed.story.title).toBe('Test Story');
      expect(parsed.codex).toBeUndefined();
    });

    it('should throw error for non-existent story', async () => {
      mockStoryService.getStory.and.returnValue(Promise.resolve(null));

      await expectAsync(service.exportStory('non-existent')).toBeRejectedWithError('Story not found');
    });

    it('should remove _rev from exported story', async () => {
      const storyWithRev = { ...mockStory, _rev: '1-abc123' };
      mockStoryService.getStory.and.returnValue(Promise.resolve(storyWithRev));
      mockCodexService.getCodex.and.returnValue(undefined);

      const result = await service.exportStory('story-123');
      const parsed = JSON.parse(result) as StoryExportData;

      expect(parsed.story._rev).toBeUndefined();
    });
  });

  describe('importStory', () => {
    beforeEach(() => {
      mockStoryService.getAllStories.and.returnValue(Promise.resolve([]));
      mockStoryService.updateStory.and.returnValue(Promise.resolve());
      mockDb.put.and.returnValue(Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' }));
    });

    it('should import story and generate new IDs', async () => {
      const jsonData = JSON.stringify(validExportData);

      const result = await service.importStory(jsonData);

      expect(result.storyId).toBeDefined();
      expect(result.storyId).not.toBe('story-123'); // Should have new ID
      expect(result.finalTitle).toBe('Test Story');
    });

    it('should handle duplicate title by appending (imported)', async () => {
      const existingStory = { ...mockStory, title: 'Test Story' };
      mockStoryService.getAllStories.and.returnValue(Promise.resolve([existingStory]));

      const jsonData = JSON.stringify(validExportData);
      const result = await service.importStory(jsonData);

      expect(result.finalTitle).toBe('Test Story (imported)');
    });

    it('should handle multiple duplicates by appending (imported N)', async () => {
      const existingStories = [
        { ...mockStory, title: 'Test Story' },
        { ...mockStory, title: 'Test Story (imported)' }
      ];
      mockStoryService.getAllStories.and.returnValue(Promise.resolve(existingStories));

      const jsonData = JSON.stringify(validExportData);
      const result = await service.importStory(jsonData);

      expect(result.finalTitle).toBe('Test Story (imported 2)');
    });

    it('should import story without codex', async () => {
      const exportWithoutCodex = { ...validExportData, codex: undefined };
      const jsonData = JSON.stringify(exportWithoutCodex);

      const result = await service.importStory(jsonData);

      expect(result.storyId).toBeDefined();
      expect(result.codexId).toBeUndefined();
    });

    it('should import story with codex', async () => {
      const jsonData = JSON.stringify(validExportData);

      const result = await service.importStory(jsonData);

      expect(result.storyId).toBeDefined();
      expect(result.codexId).toBeDefined();
      expect(mockCodexService.setCodexCache).toHaveBeenCalled();
    });

    it('should regenerate beat IDs in scene content', async () => {
      const jsonData = JSON.stringify(validExportData);

      // Capture the story that was saved
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let savedStory: any;
      mockDb.put.and.callFake((doc: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((doc as any).chapters) {
          savedStory = doc;
        }
        return Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' });
      });

      await service.importStory(jsonData);

      // The beat ID should be regenerated (different from original)
      const sceneContent = savedStory?.chapters?.[0]?.scenes?.[0]?.content;
      expect(sceneContent).toBeDefined();
      expect(sceneContent).toContain('data-beat-id=');
      expect(sceneContent).not.toContain('data-beat-id="beat-1"'); // Original ID should be replaced
    });
  });

  describe('downloadExport', () => {
    it('should call downloadFile with correct parameters', () => {
      const jsonData = '{"test": "data"}';
      const storyTitle = 'My Test Story';

      service.downloadExport(jsonData, storyTitle);

      expect(mockDatabaseBackupService.downloadFile).toHaveBeenCalled();
      const args = mockDatabaseBackupService.downloadFile.calls.mostRecent().args;
      expect(args[0]).toBe(jsonData);
      expect(args[1]).toMatch(/my-test-story-export-\d{4}-\d{2}-\d{2}\.json/);
      expect(args[2]).toBe('application/json');
    });

    it('should sanitize special characters in filename', () => {
      const jsonData = '{}';
      const storyTitle = 'Story: A "Special" Tale!';

      service.downloadExport(jsonData, storyTitle);

      const args = mockDatabaseBackupService.downloadFile.calls.mostRecent().args;
      expect(args[1]).not.toContain(':');
      expect(args[1]).not.toContain('"');
      expect(args[1]).not.toContain('!');
    });
  });

  describe('safeParseDate (via regenerateStoryIds)', () => {
    it('should handle valid date strings', async () => {
      mockStoryService.getAllStories.and.returnValue(Promise.resolve([]));
      mockDb.put.and.returnValue(Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' }));

      const exportWithValidDates = {
        ...validExportData,
        story: {
          ...validExportData.story,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-02T00:00:00.000Z'
        }
      };
      const jsonData = JSON.stringify(exportWithValidDates);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let savedStory: any;
      mockDb.put.and.callFake((doc: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((doc as any).chapters) {
          savedStory = doc;
        }
        return Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' });
      });

      await service.importStory(jsonData);

      // Dates should be reset to current time on import
      expect(savedStory?.createdAt).toBeInstanceOf(Date);
      expect(savedStory?.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle invalid date by using current date', async () => {
      mockStoryService.getAllStories.and.returnValue(Promise.resolve([]));
      mockDb.put.and.returnValue(Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' }));

      const exportWithInvalidDates = {
        ...validExportData,
        story: {
          ...validExportData.story,
          chapters: [{
            ...validExportData.story.chapters[0],
            createdAt: 'invalid-date',
            updatedAt: 'also-invalid'
          }]
        }
      };
      const jsonData = JSON.stringify(exportWithInvalidDates);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let savedStory: any;
      mockDb.put.and.callFake((doc: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((doc as any).chapters) {
          savedStory = doc;
        }
        return Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' });
      });

      await service.importStory(jsonData);

      // Invalid dates should be replaced with valid Date objects
      const chapter = savedStory?.chapters?.[0];
      expect(chapter?.createdAt).toBeInstanceOf(Date);
      expect(chapter?.updatedAt).toBeInstanceOf(Date);
      expect(isNaN(chapter?.createdAt?.getTime())).toBeFalse();
      expect(isNaN(chapter?.updatedAt?.getTime())).toBeFalse();
    });
  });

  describe('ID regeneration', () => {
    it('should generate unique IDs for all entities', async () => {
      mockStoryService.getAllStories.and.returnValue(Promise.resolve([]));

      const savedDocs: unknown[] = [];
      mockDb.put.and.callFake((doc: unknown) => {
        savedDocs.push(doc);
        return Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' });
      });

      const jsonData = JSON.stringify(validExportData);
      const result = await service.importStory(jsonData);

      // Story should have new ID
      expect(result.storyId).not.toBe('story-123');

      // Find the saved story
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const savedStory = savedDocs.find((d: any) => d.chapters) as any;
      expect(savedStory).toBeDefined();

      // Chapter should have new ID
      expect(savedStory.chapters[0].id).not.toBe('chapter-1');

      // Scene should have new ID
      expect(savedStory.chapters[0].scenes[0].id).not.toBe('scene-1');

      // Codex should have new ID
      expect(result.codexId).not.toBe('codex-123');
    });

    it('should update codex storyId to match new story ID', async () => {
      mockStoryService.getAllStories.and.returnValue(Promise.resolve([]));

      let savedCodex: Codex | undefined;
      mockDb.put.and.callFake((doc: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((doc as any).type === 'codex') {
          savedCodex = doc as Codex;
        }
        return Promise.resolve({ ok: true, id: 'new-id', rev: '1-new' });
      });

      const jsonData = JSON.stringify(validExportData);
      const result = await service.importStory(jsonData);

      expect(savedCodex).toBeDefined();
      expect(savedCodex?.storyId).toBe(result.storyId);
    });
  });
});
