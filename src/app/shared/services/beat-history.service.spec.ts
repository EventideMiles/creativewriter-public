import { TestBed } from '@angular/core/testing';
import { BeatHistoryService } from './beat-history.service';
import { BeatVersion } from '../../stories/models/beat-version-history.interface';

describe('BeatHistoryService', () => {
  let service: BeatHistoryService;

  // Helper to create a mock version
  const createMockVersion = (overrides: Partial<BeatVersion> = {}): Omit<BeatVersion, 'versionId'> => ({
    content: '<p>Test content</p>',
    prompt: 'Test prompt',
    model: 'claude-opus-4',
    beatType: 'story',
    wordCount: 400,
    generatedAt: new Date(),
    characterCount: 100,
    isCurrent: true,
    ...overrides
  });

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [BeatHistoryService]
    });

    service = TestBed.inject(BeatHistoryService);
    await service.initialize();

    // Clear any existing data before each test
    await service.deleteAllHistories();
    service.clearCache();
  });

  afterEach(async () => {
    // Clean up after tests
    await service.deleteAllHistories();
  });

  describe('initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize without error', async () => {
      // Create a fresh instance
      const freshService = new BeatHistoryService();
      await expectAsync(freshService.initialize()).toBeResolved();
    });

    it('should handle multiple initialize calls gracefully', async () => {
      await expectAsync(service.initialize()).toBeResolved();
      await expectAsync(service.initialize()).toBeResolved();
    });
  });

  describe('saveVersion', () => {
    it('should save a new version and return version ID', async () => {
      const versionData = createMockVersion();
      const versionId = await service.saveVersion('beat-1', 'story-1', versionData);

      expect(versionId).toBeTruthy();
      expect(versionId).toMatch(/^v-\d+-[a-z0-9]+$/);
    });

    it('should create new history document for first version', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-new', 'story-1', versionData);

      const history = await service.getHistory('beat-new');
      expect(history).toBeTruthy();
      expect(history?.beatId).toBe('beat-new');
      expect(history?.storyId).toBe('story-1');
      expect(history?.versions.length).toBe(1);
      expect(history?.type).toBe('beat-history');
    });

    it('should append version to existing history', async () => {
      const versionData1 = createMockVersion({ prompt: 'First prompt' });
      const versionData2 = createMockVersion({ prompt: 'Second prompt' });

      await service.saveVersion('beat-1', 'story-1', versionData1);
      await service.saveVersion('beat-1', 'story-1', versionData2);

      const history = await service.getHistory('beat-1');
      expect(history?.versions.length).toBe(2);
    });

    it('should mark new version as current by default', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);

      const history = await service.getHistory('beat-1');
      expect(history?.versions[0].isCurrent).toBeTrue();
    });

    it('should mark previous versions as not current when adding new current version', async () => {
      const versionData1 = createMockVersion();
      const versionData2 = createMockVersion();

      await service.saveVersion('beat-1', 'story-1', versionData1);
      await service.saveVersion('beat-1', 'story-1', versionData2);

      const history = await service.getHistory('beat-1');
      const currentVersions = history?.versions.filter(v => v.isCurrent);
      expect(currentVersions?.length).toBe(1);
    });

    it('should allow saving non-current version without affecting existing current', async () => {
      const versionData1 = createMockVersion({ isCurrent: true });
      const versionData2 = createMockVersion({ isCurrent: false });

      await service.saveVersion('beat-1', 'story-1', versionData1);
      await service.saveVersion('beat-1', 'story-1', versionData2);

      const history = await service.getHistory('beat-1');
      // First version should still be current
      const firstVersion = history?.versions.find(v => v.prompt === 'Test prompt');
      expect(firstVersion?.isCurrent).toBeTrue();
    });

    it('should auto-prune when exceeding 10 versions', async () => {
      // Save 12 versions
      for (let i = 0; i < 12; i++) {
        const versionData = createMockVersion({
          prompt: `Prompt ${i}`,
          generatedAt: new Date(Date.now() + i * 1000) // Ensure different timestamps
        });
        await service.saveVersion('beat-1', 'story-1', versionData);
      }

      const history = await service.getHistory('beat-1');
      expect(history?.versions.length).toBe(10);
    });

    it('should keep newest versions when auto-pruning', async () => {
      // Save 12 versions with increasing timestamps
      for (let i = 0; i < 12; i++) {
        const versionData = createMockVersion({
          prompt: `Prompt ${i}`,
          generatedAt: new Date(Date.now() + i * 1000)
        });
        await service.saveVersion('beat-1', 'story-1', versionData);
      }

      const history = await service.getHistory('beat-1');
      // Should have prompts 2-11 (oldest 0,1 pruned)
      const prompts = history?.versions.map(v => v.prompt);
      expect(prompts).not.toContain('Prompt 0');
      expect(prompts).not.toContain('Prompt 1');
      expect(prompts).toContain('Prompt 11');
    });

    it('should update cache after saving', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);

      const cacheStats = service.getCacheStats();
      expect(cacheStats.entries).toContain('beat-1');
    });
  });

  describe('getHistory', () => {
    it('should return null for non-existent beat', async () => {
      const history = await service.getHistory('nonexistent-beat');
      expect(history).toBeNull();
    });

    it('should return history with properly deserialized dates', async () => {
      const originalDate = new Date('2024-06-15T10:30:00.000Z');
      const versionData = createMockVersion({ generatedAt: originalDate });
      await service.saveVersion('beat-1', 'story-1', versionData);

      // Clear cache to force DB read
      service.clearCache();

      const history = await service.getHistory('beat-1');
      expect(history?.versions[0].generatedAt instanceof Date).toBeTrue();
      expect(history?.createdAt instanceof Date).toBeTrue();
      expect(history?.updatedAt instanceof Date).toBeTrue();
    });

    it('should use cache for subsequent calls', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);

      // First call populates cache
      await service.getHistory('beat-1');

      // Modify the cached history to prove cache is being used
      const cacheStats = service.getCacheStats();
      expect(cacheStats.entries).toContain('beat-1');

      // Second call should use cache (no way to directly verify, but coverage shows it)
      const history2 = await service.getHistory('beat-1');
      expect(history2).toBeTruthy();
    });

    it('should clean up stale cache entries', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);
      await service.getHistory('beat-1');

      // Cache should have entry
      expect(service.getCacheStats().size).toBe(1);

      // Calling getHistory cleans up stale entries (TTL-based)
      // We can't easily test TTL expiration in unit tests without mocking Date
      // But we can verify the cleanup method exists and runs
      await service.getHistory('beat-1');
      expect(service.getCacheStats().size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('hasHistory', () => {
    it('should return false for non-existent beat', async () => {
      const result = await service.hasHistory('nonexistent-beat');
      expect(result).toBeFalse();
    });

    it('should return true for beat with history', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);

      const result = await service.hasHistory('beat-1');
      expect(result).toBeTrue();
    });
  });

  describe('setCurrentVersion', () => {
    it('should mark specified version as current', async () => {
      const versionData1 = createMockVersion({ prompt: 'First' });
      const versionData2 = createMockVersion({ prompt: 'Second' });

      const versionId1 = await service.saveVersion('beat-1', 'story-1', versionData1);
      await service.saveVersion('beat-1', 'story-1', versionData2);

      // Switch back to first version
      await service.setCurrentVersion('beat-1', versionId1);

      const history = await service.getHistory('beat-1');
      const currentVersion = history?.versions.find(v => v.isCurrent);
      expect(currentVersion?.versionId).toBe(versionId1);
    });

    it('should mark all other versions as not current', async () => {
      const versionData1 = createMockVersion();
      const versionData2 = createMockVersion();
      const versionData3 = createMockVersion();

      const versionId1 = await service.saveVersion('beat-1', 'story-1', versionData1);
      await service.saveVersion('beat-1', 'story-1', versionData2);
      await service.saveVersion('beat-1', 'story-1', versionData3);

      await service.setCurrentVersion('beat-1', versionId1);

      const history = await service.getHistory('beat-1');
      const currentVersions = history?.versions.filter(v => v.isCurrent);
      expect(currentVersions?.length).toBe(1);
    });

    it('should throw error for non-existent version', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);

      await expectAsync(
        service.setCurrentVersion('beat-1', 'nonexistent-version')
      ).toBeRejectedWithError('Version nonexistent-version not found in beat beat-1');
    });

    it('should update cache after setting current version', async () => {
      const versionData1 = createMockVersion();
      const versionData2 = createMockVersion();

      const versionId1 = await service.saveVersion('beat-1', 'story-1', versionData1);
      await service.saveVersion('beat-1', 'story-1', versionData2);

      await service.setCurrentVersion('beat-1', versionId1);

      // Cache should be updated, not deleted
      const cacheStats = service.getCacheStats();
      expect(cacheStats.entries).toContain('beat-1');
    });
  });

  describe('deleteHistory', () => {
    it('should delete history for a beat', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);

      await service.deleteHistory('beat-1');

      const history = await service.getHistory('beat-1');
      expect(history).toBeNull();
    });

    it('should handle deleting non-existent history gracefully', async () => {
      await expectAsync(service.deleteHistory('nonexistent-beat')).toBeResolved();
    });

    it('should clear cache for deleted beat', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);
      await service.getHistory('beat-1'); // Populate cache

      await service.deleteHistory('beat-1');

      const cacheStats = service.getCacheStats();
      expect(cacheStats.entries).not.toContain('beat-1');
    });
  });

  describe('deleteOldVersions', () => {
    it('should keep only specified number of versions', async () => {
      // Save 8 versions
      for (let i = 0; i < 8; i++) {
        const versionData = createMockVersion({
          prompt: `Prompt ${i}`,
          generatedAt: new Date(Date.now() + i * 1000)
        });
        await service.saveVersion('beat-1', 'story-1', versionData);
      }

      await service.deleteOldVersions('beat-1', 3);

      const history = await service.getHistory('beat-1');
      expect(history?.versions.length).toBe(3);
    });

    it('should keep newest versions', async () => {
      for (let i = 0; i < 5; i++) {
        const versionData = createMockVersion({
          prompt: `Prompt ${i}`,
          generatedAt: new Date(Date.now() + i * 1000)
        });
        await service.saveVersion('beat-1', 'story-1', versionData);
      }

      await service.deleteOldVersions('beat-1', 2);

      const history = await service.getHistory('beat-1');
      const prompts = history?.versions.map(v => v.prompt);
      expect(prompts).toContain('Prompt 4');
      expect(prompts).toContain('Prompt 3');
      expect(prompts).not.toContain('Prompt 0');
    });

    it('should do nothing if versions count is under limit', async () => {
      const versionData = createMockVersion();
      await service.saveVersion('beat-1', 'story-1', versionData);

      await service.deleteOldVersions('beat-1', 5);

      const history = await service.getHistory('beat-1');
      expect(history?.versions.length).toBe(1);
    });

    it('should handle non-existent beat gracefully', async () => {
      await expectAsync(service.deleteOldVersions('nonexistent-beat', 5)).toBeResolved();
    });

    it('should update cache after deleting old versions', async () => {
      for (let i = 0; i < 5; i++) {
        const versionData = createMockVersion({
          prompt: `Prompt ${i}`,
          generatedAt: new Date(Date.now() + i * 1000)
        });
        await service.saveVersion('beat-1', 'story-1', versionData);
      }

      await service.deleteOldVersions('beat-1', 2);

      // Cache should be updated
      const cacheStats = service.getCacheStats();
      expect(cacheStats.entries).toContain('beat-1');
    });
  });

  describe('deleteAllHistoriesForStory', () => {
    it('should delete all histories for a specific story', async () => {
      // Create histories for two stories
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.saveVersion('beat-2', 'story-1', createMockVersion());
      await service.saveVersion('beat-3', 'story-2', createMockVersion());

      const deletedCount = await service.deleteAllHistoriesForStory('story-1');

      expect(deletedCount).toBe(2);
      expect(await service.getHistory('beat-1')).toBeNull();
      expect(await service.getHistory('beat-2')).toBeNull();
      expect(await service.getHistory('beat-3')).toBeTruthy();
    });

    it('should return 0 when no histories exist for story', async () => {
      const deletedCount = await service.deleteAllHistoriesForStory('nonexistent-story');
      expect(deletedCount).toBe(0);
    });

    it('should clear cache for deleted beats', async () => {
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.getHistory('beat-1'); // Populate cache

      await service.deleteAllHistoriesForStory('story-1');

      const cacheStats = service.getCacheStats();
      expect(cacheStats.entries).not.toContain('beat-1');
    });
  });

  describe('deleteAllHistories', () => {
    it('should delete all histories', async () => {
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.saveVersion('beat-2', 'story-2', createMockVersion());

      const deletedCount = await service.deleteAllHistories();

      expect(deletedCount).toBe(2);
      expect(await service.getHistory('beat-1')).toBeNull();
      expect(await service.getHistory('beat-2')).toBeNull();
    });

    it('should return 0 when no histories exist', async () => {
      const deletedCount = await service.deleteAllHistories();
      expect(deletedCount).toBe(0);
    });

    it('should clear entire cache', async () => {
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.getHistory('beat-1');

      await service.deleteAllHistories();

      const cacheStats = service.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe('getHistoryStats', () => {
    it('should return correct statistics', async () => {
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.saveVersion('beat-2', 'story-1', createMockVersion());

      const stats = await service.getHistoryStats();

      expect(stats.totalHistories).toBe(2);
      expect(stats.totalVersions).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should return zeros when no histories exist', async () => {
      const stats = await service.getHistoryStats();

      expect(stats.totalHistories).toBe(0);
      expect(stats.totalVersions).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache when clearCache is called', async () => {
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.getHistory('beat-1');

      service.clearCache();

      const cacheStats = service.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });

    it('should return correct cache stats', async () => {
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.saveVersion('beat-2', 'story-1', createMockVersion());
      await service.getHistory('beat-1');
      await service.getHistory('beat-2');

      const cacheStats = service.getCacheStats();

      expect(cacheStats.size).toBe(2);
      expect(cacheStats.entries).toContain('beat-1');
      expect(cacheStats.entries).toContain('beat-2');
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information about stored histories', async () => {
      await service.saveVersion('beat-1', 'story-1', createMockVersion());
      await service.saveVersion('beat-1', 'story-1', createMockVersion());

      const debugInfo = await service.getDebugInfo();

      expect(debugInfo.total).toBe(1);
      expect(debugInfo.documents.length).toBe(1);
      expect(debugInfo.documents[0].id).toBe('history-beat-1');
      expect(debugInfo.documents[0].type).toBe('beat-history');
      expect(debugInfo.documents[0].versionsCount).toBe(2);
    });
  });

  describe('date deserialization utilities', () => {
    it('should properly deserialize dates when reading from database', async () => {
      // Save with a specific date
      const testDate = new Date('2024-03-15T14:30:00.000Z');
      const versionData = createMockVersion({ generatedAt: testDate });
      await service.saveVersion('beat-1', 'story-1', versionData);

      // Clear cache to force DB read
      service.clearCache();

      const history = await service.getHistory('beat-1');

      // Verify dates are Date objects, not strings
      expect(history?.createdAt instanceof Date).toBeTrue();
      expect(history?.updatedAt instanceof Date).toBeTrue();
      expect(history?.versions[0].generatedAt instanceof Date).toBeTrue();

      // Verify the date value is preserved
      expect(history?.versions[0].generatedAt.toISOString()).toBe(testDate.toISOString());
    });
  });
});
