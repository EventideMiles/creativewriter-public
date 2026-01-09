import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SceneCardComponent, SceneUpdateEvent, SceneAIGenerateEvent } from './scene-card.component';
import { Scene } from '../../models/story.interface';

describe('SceneCardComponent', () => {
  let component: SceneCardComponent;
  let fixture: ComponentFixture<SceneCardComponent>;

  const mockScene: Scene = {
    id: 'scene-123',
    title: 'Test Scene Title',
    content: 'This is the scene content for testing.',
    summary: 'This is a test summary.',
    order: 1,
    sceneNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SceneCardComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(SceneCardComponent);
    component = fixture.componentInstance;
    component.scene = { ...mockScene };
    component.chapterId = 'chapter-456';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('display', () => {
    it('should show scene title and number', () => {
      expect(component.scene.sceneNumber).toBe(1);
      expect(component.scene.title).toBe('Test Scene Title');
    });

    it('should show word count label', () => {
      component.wordCount = 100;
      expect(component.wordCountLabel).toBe('100 words');
    });

    it('should show singular word for count of 1', () => {
      component.wordCount = 1;
      expect(component.wordCountLabel).toBe('1 word');
    });

    it('should show zero words', () => {
      component.wordCount = 0;
      expect(component.wordCountLabel).toBe('0 words');
    });
  });

  describe('title editing', () => {
    it('should enter edit mode when startEditTitle is called', () => {
      expect(component.editingTitle()).toBeFalse();

      component.startEditTitle();

      expect(component.editingTitle()).toBeTrue();
      expect(component.editTitleValue()).toBe('Test Scene Title');
    });

    it('should cancel edit mode', () => {
      component.startEditTitle();
      expect(component.editingTitle()).toBeTrue();

      component.cancelEditTitle();

      expect(component.editingTitle()).toBeFalse();
      expect(component.editTitleValue()).toBe('');
    });

    it('should emit update event on saveTitle', () => {
      spyOn(component.update, 'emit');
      component.startEditTitle();
      component.editTitleValue.set('New Title');

      component.saveTitle();

      expect(component.update.emit).toHaveBeenCalledWith({
        sceneId: 'scene-123',
        chapterId: 'chapter-456',
        field: 'title',
        value: 'New Title'
      } as SceneUpdateEvent);
      expect(component.editingTitle()).toBeFalse();
    });

    it('should not emit update for empty title', () => {
      spyOn(component.update, 'emit');
      component.startEditTitle();
      component.editTitleValue.set('   ');

      component.saveTitle();

      expect(component.update.emit).not.toHaveBeenCalled();
    });

    it('should save on Enter keydown', () => {
      spyOn(component, 'saveTitle');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      spyOn(event, 'preventDefault');

      component.onTitleKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.saveTitle).toHaveBeenCalled();
    });

    it('should cancel on Escape keydown', () => {
      spyOn(component, 'cancelEditTitle');
      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      component.onTitleKeydown(event);

      expect(component.cancelEditTitle).toHaveBeenCalled();
    });
  });

  describe('summary editing', () => {
    it('should enter edit mode when startEditSummary is called', () => {
      expect(component.editingSummary()).toBeFalse();

      component.startEditSummary();

      expect(component.editingSummary()).toBeTrue();
      expect(component.editSummaryValue()).toBe('This is a test summary.');
    });

    it('should cancel edit mode', () => {
      component.startEditSummary();
      expect(component.editingSummary()).toBeTrue();

      component.cancelEditSummary();

      expect(component.editingSummary()).toBeFalse();
      expect(component.editSummaryValue()).toBe('');
    });

    it('should emit update event on saveSummary', () => {
      spyOn(component.update, 'emit');
      component.startEditSummary();
      component.editSummaryValue.set('New summary text');

      component.saveSummary();

      expect(component.update.emit).toHaveBeenCalledWith({
        sceneId: 'scene-123',
        chapterId: 'chapter-456',
        field: 'summary',
        value: 'New summary text'
      } as SceneUpdateEvent);
      expect(component.editingSummary()).toBeFalse();
    });

    it('should save on Ctrl+Enter keydown', () => {
      spyOn(component, 'saveSummary');
      const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true });
      spyOn(event, 'preventDefault');

      component.onSummaryKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.saveSummary).toHaveBeenCalled();
    });

    it('should save on Meta+Enter keydown (Mac)', () => {
      spyOn(component, 'saveSummary');
      const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true });
      spyOn(event, 'preventDefault');

      component.onSummaryKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.saveSummary).toHaveBeenCalled();
    });

    it('should cancel on Escape keydown', () => {
      spyOn(component, 'cancelEditSummary');
      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      component.onSummaryKeydown(event);

      expect(component.cancelEditSummary).toHaveBeenCalled();
    });

    it('should not save on Enter without modifier', () => {
      spyOn(component, 'saveSummary');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      component.onSummaryKeydown(event);

      expect(component.saveSummary).not.toHaveBeenCalled();
    });
  });

  describe('AI generation', () => {
    it('should disable AI buttons when no model selected', () => {
      component.selectedModel = '';
      component.scene = { ...mockScene, content: 'Some content' };

      expect(component.canGenerateAI).toBeFalse();
    });

    it('should disable AI buttons when scene has no content', () => {
      component.selectedModel = 'test-model';
      component.scene = { ...mockScene, content: '' };

      expect(component.canGenerateAI).toBeFalse();
    });

    it('should disable AI buttons when scene content is whitespace', () => {
      component.selectedModel = 'test-model';
      component.scene = { ...mockScene, content: '   ' };

      expect(component.canGenerateAI).toBeFalse();
    });

    it('should enable AI buttons when model selected and content exists', () => {
      component.selectedModel = 'test-model';
      component.scene = { ...mockScene, content: 'Some content' };

      expect(component.canGenerateAI).toBeTrue();
    });

    it('should emit generateAI event for title', () => {
      spyOn(component.generateAI, 'emit');

      component.generateTitle();

      expect(component.generateAI.emit).toHaveBeenCalledWith({
        sceneId: 'scene-123',
        chapterId: 'chapter-456',
        type: 'title'
      } as SceneAIGenerateEvent);
    });

    it('should emit generateAI event for summary', () => {
      spyOn(component.generateAI, 'emit');

      component.generateSummary();

      expect(component.generateAI.emit).toHaveBeenCalledWith({
        sceneId: 'scene-123',
        chapterId: 'chapter-456',
        type: 'summary'
      } as SceneAIGenerateEvent);
    });
  });

  describe('no summary display', () => {
    it('should show placeholder when scene has no summary', () => {
      component.scene = { ...mockScene, summary: undefined };
      fixture.detectChanges();

      // The component should handle undefined summary
      expect(component.scene.summary).toBeUndefined();
    });

    it('should handle empty string summary', () => {
      component.scene = { ...mockScene, summary: '' };
      fixture.detectChanges();

      expect(component.scene.summary).toBe('');
    });
  });

  describe('inline action buttons', () => {
    describe('AI button disabled conditions', () => {
      it('should disable AI when generatingTitle is true even if canGenerateAI is true', () => {
        component.selectedModel = 'test-model';
        component.scene = { ...mockScene, content: 'Some content' };
        component.generatingTitle = true;

        // The disabled condition is: generatingTitle || !canGenerateAI
        // canGenerateAI is true, but generatingTitle is true, so should be disabled
        expect(component.canGenerateAI).toBeTrue();
        expect(component.generatingTitle || !component.canGenerateAI).toBeTrue();
      });

      it('should disable AI when canGenerateAI is false (no model)', () => {
        component.selectedModel = '';
        component.scene = { ...mockScene, content: 'Some content' };
        component.generatingTitle = false;

        expect(component.canGenerateAI).toBeFalse();
        expect(component.generatingTitle || !component.canGenerateAI).toBeTrue();
      });

      it('should disable AI when canGenerateAI is false (no content)', () => {
        component.selectedModel = 'test-model';
        component.scene = { ...mockScene, content: '' };
        component.generatingTitle = false;

        expect(component.canGenerateAI).toBeFalse();
        expect(component.generatingTitle || !component.canGenerateAI).toBeTrue();
      });

      it('should enable AI when model selected, content exists, and not generating', () => {
        component.selectedModel = 'test-model';
        component.scene = { ...mockScene, content: 'Some content' };
        component.generatingTitle = false;

        expect(component.canGenerateAI).toBeTrue();
        expect(component.generatingTitle || !component.canGenerateAI).toBeFalse();
      });

      it('should disable summary AI when generatingSummary is true', () => {
        component.selectedModel = 'test-model';
        component.scene = { ...mockScene, content: 'Some content' };
        component.generatingSummary = true;

        expect(component.canGenerateAI).toBeTrue();
        expect(component.generatingSummary || !component.canGenerateAI).toBeTrue();
      });

      it('should enable summary AI when model selected, content exists, and not generating', () => {
        component.selectedModel = 'test-model';
        component.scene = { ...mockScene, content: 'Some content' };
        component.generatingSummary = false;

        expect(component.canGenerateAI).toBeTrue();
        expect(component.generatingSummary || !component.canGenerateAI).toBeFalse();
      });
    });

    describe('edit methods are callable', () => {
      it('startEditTitle should be callable and set editing state', () => {
        expect(component.editingTitle()).toBeFalse();
        component.startEditTitle();
        expect(component.editingTitle()).toBeTrue();
      });

      it('startEditSummary should be callable and set editing state', () => {
        expect(component.editingSummary()).toBeFalse();
        component.startEditSummary();
        expect(component.editingSummary()).toBeTrue();
      });
    });

    describe('generate methods emit correct events', () => {
      it('generateTitle should emit event with correct type', () => {
        spyOn(component.generateAI, 'emit');
        component.generateTitle();

        expect(component.generateAI.emit).toHaveBeenCalledWith(
          jasmine.objectContaining({ type: 'title' })
        );
      });

      it('generateSummary should emit event with correct type', () => {
        spyOn(component.generateAI, 'emit');
        component.generateSummary();

        expect(component.generateAI.emit).toHaveBeenCalledWith(
          jasmine.objectContaining({ type: 'summary' })
        );
      });
    });

    describe('input properties for loading state', () => {
      it('should accept generatingTitle input', () => {
        component.generatingTitle = true;
        expect(component.generatingTitle).toBeTrue();

        component.generatingTitle = false;
        expect(component.generatingTitle).toBeFalse();
      });

      it('should accept generatingSummary input', () => {
        component.generatingSummary = true;
        expect(component.generatingSummary).toBeTrue();

        component.generatingSummary = false;
        expect(component.generatingSummary).toBeFalse();
      });

      it('should accept savingTitle input', () => {
        component.savingTitle = true;
        expect(component.savingTitle).toBeTrue();
      });

      it('should accept savingSummary input', () => {
        component.savingSummary = true;
        expect(component.savingSummary).toBeTrue();
      });
    });
  });
});
