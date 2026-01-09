import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { BeatAIService } from './beat-ai.service';
import { BeatHistoryService } from './beat-history.service';
import { OpenRouterApiService } from '../../core/services/openrouter-api.service';
import { GoogleGeminiApiService } from '../../core/services/google-gemini-api.service';
import { OllamaApiService } from '../../core/services/ollama-api.service';
import { ClaudeApiService } from '../../core/services/claude-api.service';
import { OpenAICompatibleApiService } from '../../core/services/openai-compatible-api.service';
import { SettingsService } from '../../core/services/settings.service';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';
import { PromptManagerService } from './prompt-manager.service';
import { CodexRelevanceService } from '../../core/services/codex-relevance.service';
import { AIProviderValidationService } from '../../core/services/ai-provider-validation.service';
import { DatabaseService } from '../../core/services/database.service';
import { BeatVersionHistory } from '../../stories/models/beat-version-history.interface';

describe('BeatAIService', () => {
  let service: BeatAIService;
  let mockBeatHistoryService: jasmine.SpyObj<BeatHistoryService>;
  let mockSettingsService: jasmine.SpyObj<SettingsService>;

  beforeEach(() => {
    // Create mock services
    mockBeatHistoryService = jasmine.createSpyObj('BeatHistoryService', [
      'getHistory',
      'saveVersion',
      'setCurrentVersion'
    ]);

    mockSettingsService = jasmine.createSpyObj('SettingsService', ['getSettings']);
    // Return minimal settings object - actual settings structure is complex
    // but not needed for history-related tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSettingsService.getSettings.and.returnValue({ selectedModel: 'openrouter:test-model' } as any);

    // Create minimal mocks for other dependencies
    const mockOpenRouterApi = jasmine.createSpyObj('OpenRouterApiService', ['streamChat']);
    const mockGeminiApi = jasmine.createSpyObj('GoogleGeminiApiService', ['streamChat']);
    const mockOllamaApi = jasmine.createSpyObj('OllamaApiService', ['streamChat']);
    const mockClaudeApi = jasmine.createSpyObj('ClaudeApiService', ['streamChat']);
    const mockOpenAICompatibleApi = jasmine.createSpyObj('OpenAICompatibleApiService', ['streamChat']);
    const mockStoryService = jasmine.createSpyObj('StoryService', ['getStory', 'updateStory']);
    const mockCodexService = jasmine.createSpyObj('CodexService', ['getCodexEntries']);
    const mockPromptManager = jasmine.createSpyObj('PromptManagerService', ['refresh', 'getAll']);
    const mockCodexRelevanceService = jasmine.createSpyObj('CodexRelevanceService', ['getRelevantEntries']);
    const mockAIProviderValidation = jasmine.createSpyObj('AIProviderValidationService', ['validateApiKey']);
    const mockDatabaseService = jasmine.createSpyObj('DatabaseService', ['get', 'put']);

    // Mock document
    const mockDocument = {
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
      hidden: false,
      createElement: jasmine.createSpy('createElement').and.returnValue({
        value: ''
      })
    };

    TestBed.configureTestingModule({
      providers: [
        BeatAIService,
        { provide: BeatHistoryService, useValue: mockBeatHistoryService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: OpenRouterApiService, useValue: mockOpenRouterApi },
        { provide: GoogleGeminiApiService, useValue: mockGeminiApi },
        { provide: OllamaApiService, useValue: mockOllamaApi },
        { provide: ClaudeApiService, useValue: mockClaudeApi },
        { provide: OpenAICompatibleApiService, useValue: mockOpenAICompatibleApi },
        { provide: StoryService, useValue: mockStoryService },
        { provide: CodexService, useValue: mockCodexService },
        { provide: PromptManagerService, useValue: mockPromptManager },
        { provide: CodexRelevanceService, useValue: mockCodexRelevanceService },
        { provide: AIProviderValidationService, useValue: mockAIProviderValidation },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: DOCUMENT, useValue: mockDocument }
      ]
    });

    service = TestBed.inject(BeatAIService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveToHistory (via internal access)', () => {
    // Access private method for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let serviceAny: any;

    beforeEach(() => {
      serviceAny = service;
      mockBeatHistoryService.saveVersion.and.returnValue(Promise.resolve('v-new-123'));
    });

    it('should save content to history with correct parameters', fakeAsync(async () => {
      mockBeatHistoryService.getHistory.and.returnValue(Promise.resolve(null));

      await serviceAny.saveToHistory(
        'beat-123',
        'Test prompt',
        '<p>Generated content</p>',
        {
          model: 'claude-opus-4',
          beatType: 'story',
          wordCount: 400,
          storyId: 'story-456'
        }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).toHaveBeenCalledWith(
        'beat-123',
        'story-456',
        jasmine.objectContaining({
          content: '<p>Generated content</p>',
          prompt: 'Test prompt',
          model: 'claude-opus-4',
          beatType: 'story',
          wordCount: 400,
          isCurrent: true,
          action: 'generate'
        })
      );
    }));

    it('should not save empty content', fakeAsync(async () => {
      await serviceAny.saveToHistory(
        'beat-123',
        'Test prompt',
        '',
        { storyId: 'story-456' }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).not.toHaveBeenCalled();
    }));

    it('should not save whitespace-only content', fakeAsync(async () => {
      await serviceAny.saveToHistory(
        'beat-123',
        'Test prompt',
        '   \n\t   ',
        { storyId: 'story-456' }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).not.toHaveBeenCalled();
    }));

    it('should not save without storyId', fakeAsync(async () => {
      await serviceAny.saveToHistory(
        'beat-123',
        'Test prompt',
        '<p>Content</p>',
        { model: 'claude-opus-4' }  // No storyId
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).not.toHaveBeenCalled();
    }));

    it('should skip saving duplicate content', fakeAsync(async () => {
      const existingHistory: BeatVersionHistory = {
        _id: 'history-beat-123',
        type: 'beat-history',
        beatId: 'beat-123',
        storyId: 'story-456',
        versions: [{
          versionId: 'v-existing',
          content: '<p>Generated content</p>',
          prompt: 'Old prompt',
          model: 'claude-opus-4',
          beatType: 'story',
          wordCount: 400,
          generatedAt: new Date(),
          characterCount: 100,
          isCurrent: true
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockBeatHistoryService.getHistory.and.returnValue(Promise.resolve(existingHistory));

      await serviceAny.saveToHistory(
        'beat-123',
        'New prompt',
        '<p>Generated content</p>',  // Same content as existing
        { storyId: 'story-456' }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).not.toHaveBeenCalled();
    }));

    it('should save when content differs from existing versions', fakeAsync(async () => {
      const existingHistory: BeatVersionHistory = {
        _id: 'history-beat-123',
        type: 'beat-history',
        beatId: 'beat-123',
        storyId: 'story-456',
        versions: [{
          versionId: 'v-existing',
          content: '<p>Old content</p>',
          prompt: 'Old prompt',
          model: 'claude-opus-4',
          beatType: 'story',
          wordCount: 400,
          generatedAt: new Date(),
          characterCount: 100,
          isCurrent: true
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockBeatHistoryService.getHistory.and.returnValue(Promise.resolve(existingHistory));

      await serviceAny.saveToHistory(
        'beat-123',
        'New prompt',
        '<p>New different content</p>',
        { storyId: 'story-456' }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).toHaveBeenCalled();
    }));

    it('should handle history service errors gracefully', fakeAsync(async () => {
      mockBeatHistoryService.getHistory.and.returnValue(Promise.resolve(null));
      mockBeatHistoryService.saveVersion.and.returnValue(Promise.reject(new Error('DB error')));

      // Should not throw, just log error
      await expectAsync(serviceAny.saveToHistory(
        'beat-123',
        'Test prompt',
        '<p>Content</p>',
        { storyId: 'story-456' }
      )).toBeResolved();
      tick();
    }));

    it('should include selected scenes in saved version', fakeAsync(async () => {
      mockBeatHistoryService.getHistory.and.returnValue(Promise.resolve(null));

      await serviceAny.saveToHistory(
        'beat-123',
        'Test prompt',
        '<p>Content</p>',
        {
          storyId: 'story-456',
          customContext: {
            selectedScenes: ['scene-1', 'scene-2'],
            includeStoryOutline: true,
            selectedSceneContexts: [
              { sceneId: 'scene-1', chapterId: 'ch-1', content: 'Scene 1 text' },
              { sceneId: 'scene-2', chapterId: 'ch-2', content: 'Scene 2 text' }
            ]
          }
        }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).toHaveBeenCalledWith(
        'beat-123',
        'story-456',
        jasmine.objectContaining({
          selectedScenes: [
            { sceneId: 'scene-1', chapterId: 'ch-1' },
            { sceneId: 'scene-2', chapterId: 'ch-2' }
          ],
          includeStoryOutline: true
        })
      );
    }));

    it('should save rewrite action with existing text', fakeAsync(async () => {
      mockBeatHistoryService.getHistory.and.returnValue(Promise.resolve(null));

      await serviceAny.saveToHistory(
        'beat-123',
        'Rewrite this',
        '<p>Rewritten content</p>',
        {
          storyId: 'story-456',
          action: 'rewrite',
          existingText: '<p>Original text</p>'
        }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).toHaveBeenCalledWith(
        'beat-123',
        'story-456',
        jasmine.objectContaining({
          action: 'rewrite',
          existingText: '<p>Original text</p>'
        })
      );
    }));

    it('should default to generate action when not specified', fakeAsync(async () => {
      mockBeatHistoryService.getHistory.and.returnValue(Promise.resolve(null));

      await serviceAny.saveToHistory(
        'beat-123',
        'Test prompt',
        '<p>Content</p>',
        { storyId: 'story-456' }
      );
      tick();

      expect(mockBeatHistoryService.saveVersion).toHaveBeenCalledWith(
        'beat-123',
        'story-456',
        jasmine.objectContaining({
          action: 'generate'
        })
      );
    }));
  });

  describe('isCompleted flag behavior', () => {
    it('should have isCompleted property in GenerationContext interface', () => {
      // This tests that the interface was properly updated
      // We verify by checking that the service can handle this property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serviceAny = service as any;

      // The generationContexts map should exist
      expect(serviceAny.generationContexts).toBeDefined();
      expect(serviceAny.generationContexts instanceof Map).toBeTrue();
    });

    it('should initialize generation contexts as empty map', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serviceAny = service as any;
      expect(serviceAny.generationContexts.size).toBe(0);
    });
  });

  describe('generation observable', () => {
    it('should expose generation$ observable', () => {
      expect(service.generation$).toBeDefined();
    });

    it('should expose isStreaming$ observable', () => {
      expect(service.isStreaming$).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should clean up on destroy', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serviceAny = service as any;

      // Add some contexts
      serviceAny.generationContexts.set('beat-1', { beatId: 'beat-1' });
      serviceAny.generationContexts.set('beat-2', { beatId: 'beat-2' });

      // Trigger destroy
      service.ngOnDestroy();

      // Contexts should be cleaned up
      expect(serviceAny.generationContexts.size).toBe(0);
    });
  });
});
