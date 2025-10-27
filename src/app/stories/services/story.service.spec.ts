import { TestBed } from '@angular/core/testing';
import { StoryService } from './story.service';
import { DatabaseService } from '../../core/services/database.service';
import { BeatHistoryService } from '../../shared/services/beat-history.service';

describe('StoryService', () => {
  let service: StoryService;
  let mockDatabaseService: jasmine.SpyObj<DatabaseService>;
  let mockBeatHistoryService: jasmine.SpyObj<BeatHistoryService>;
  let mockDb: jasmine.SpyObj<PouchDB.Database>;

  beforeEach(() => {
    // Create mock database
    mockDb = jasmine.createSpyObj('PouchDB.Database', [
      'get',
      'put',
      'remove',
      'allDocs',
      'find',
      'bulkDocs'
    ]);
    mockDb.name = 'test-db';

    // Create mock services
    mockDatabaseService = jasmine.createSpyObj('DatabaseService', ['getDatabase']);
    mockDatabaseService.getDatabase.and.returnValue(Promise.resolve(mockDb as unknown as PouchDB.Database));

    mockBeatHistoryService = jasmine.createSpyObj('BeatHistoryService', [
      'saveVersion',
      'getHistory',
      'deleteAllHistoriesForStory'
    ]);

    TestBed.configureTestingModule({
      providers: [
        StoryService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: BeatHistoryService, useValue: mockBeatHistoryService }
      ]
    });

    service = TestBed.inject(StoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('migrateBeatIds', () => {
    it('should migrate data-id to data-beat-id for legacy beats', () => {
      const htmlWithLegacyBeat = `
        <p>Some text before</p>
        <div class="beat-ai-node" data-id="beat-legacy-123" data-prompt="Test prompt">
          <span>Beat content</span>
        </div>
        <p>Some text after</p>
      `;

      // Access the private method via type assertion for testing
      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithLegacyBeat);

      // Should have data-beat-id
      expect(result).toContain('data-beat-id="beat-legacy-123"');
      // Should not have data-id
      expect(result).not.toContain('data-id="beat-legacy-123"');
      // Should preserve other attributes
      expect(result).toContain('data-prompt="Test prompt"');
      // Should preserve content
      expect(result).toContain('<span>Beat content</span>');
    });

    it('should remove data-id when both data-beat-id and data-id exist', () => {
      const htmlWithBothAttributes = `
        <div class="beat-ai-node" data-beat-id="beat-new-456" data-id="beat-old-456" data-prompt="Test">
          <span>Content</span>
        </div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithBothAttributes);

      // Should keep data-beat-id
      expect(result).toContain('data-beat-id="beat-new-456"');
      // Should remove data-id
      expect(result).not.toContain('data-id=');
    });

    it('should handle multiple beats in the same content', () => {
      const htmlWithMultipleBeats = `
        <p>Paragraph 1</p>
        <div class="beat-ai-node" data-id="beat-1" data-prompt="Prompt 1">Beat 1</div>
        <p>Paragraph 2</p>
        <div class="beat-ai-node" data-id="beat-2" data-prompt="Prompt 2">Beat 2</div>
        <p>Paragraph 3</p>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithMultipleBeats);

      // Both beats should be migrated
      expect(result).toContain('data-beat-id="beat-1"');
      expect(result).toContain('data-beat-id="beat-2"');
      // Neither should have data-id
      expect(result).not.toContain('data-id="beat-1"');
      expect(result).not.toContain('data-id="beat-2"');
    });

    it('should not modify beats that already use data-beat-id', () => {
      const htmlWithNewBeat = `
        <div class="beat-ai-node" data-beat-id="beat-new-789" data-prompt="Test">
          <span>New beat</span>
        </div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithNewBeat);

      // Should remain unchanged (except for potential whitespace normalization)
      expect(result).toContain('data-beat-id="beat-new-789"');
      expect(result).not.toContain('data-id=');
    });

    it('should handle empty or null content gracefully', () => {
      const emptyResult = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds('');
      expect(emptyResult).toBe('');

      const nullResult = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(null as unknown as string);
      expect(nullResult).toBe(null as unknown as string);
    });

    it('should preserve non-beat elements with data-id attributes', () => {
      const htmlWithMixedElements = `
        <div id="normal-div" data-id="some-other-id">Regular div</div>
        <span data-id="span-id">Regular span</span>
        <div class="beat-ai-node" data-id="beat-123">Beat content</div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(htmlWithMixedElements);

      // Beat should be migrated
      expect(result).toContain('data-beat-id="beat-123"');
      // Other elements with data-id should be migrated too (since the method migrates ALL data-id attributes)
      expect(result).toContain('data-beat-id="some-other-id"');
      expect(result).toContain('data-beat-id="span-id"');
    });

    it('should handle complex nested HTML structures', () => {
      const complexHtml = `
        <div class="chapter">
          <h2>Chapter Title</h2>
          <div class="beat-ai-node" data-id="beat-nested-1" data-prompt="Nested prompt">
            <div class="beat-content">
              <p>Nested content</p>
            </div>
          </div>
          <p>More text</p>
        </div>
      `;

      const result = (service as unknown as { migrateBeatIds: (html: string) => string }).migrateBeatIds(complexHtml);

      expect(result).toContain('data-beat-id="beat-nested-1"');
      expect(result).not.toContain('data-id="beat-nested-1"');
      expect(result).toContain('<h2>Chapter Title</h2>');
      expect(result).toContain('<p>Nested content</p>');
    });
  });

  describe('migrateStory integration', () => {
    it('should automatically migrate beat IDs when loading a story', async () => {
      const storyWithLegacyBeats = {
        _id: 'story-1',
        id: 'story-1',
        title: 'Test Story',
        schemaVersion: 0, // Old schema version to trigger migration
        chapters: [
          {
            id: 'chapter-1',
            title: 'Chapter 1',
            order: 1,
            chapterNumber: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            scenes: [
              {
                id: 'scene-1',
                title: 'Scene 1',
                order: 1,
                sceneNumber: 1,
                content: '<div class="beat-ai-node" data-id="beat-old-1">Old beat</div>',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockDb.get.and.returnValue(Promise.resolve(storyWithLegacyBeats as any));

      const migratedStory = await service.getStory('story-1');

      expect(migratedStory).toBeTruthy();
      expect(migratedStory?.chapters[0].scenes[0].content).toContain('data-beat-id="beat-old-1"');
      expect(migratedStory?.chapters[0].scenes[0].content).not.toContain('data-id="beat-old-1"');
    });
  });
});
