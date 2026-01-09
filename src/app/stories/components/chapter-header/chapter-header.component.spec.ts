import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ChapterHeaderComponent, ChapterTitleUpdateEvent } from './chapter-header.component';
import { Chapter } from '../../models/story.interface';

describe('ChapterHeaderComponent', () => {
  let component: ChapterHeaderComponent;
  let fixture: ComponentFixture<ChapterHeaderComponent>;

  const mockChapter: Chapter = {
    id: 'chapter-123',
    title: 'Test Chapter',
    order: 1,
    chapterNumber: 1,
    scenes: [
      { id: 'scene-1', title: 'Scene 1', content: '', order: 1, sceneNumber: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'scene-2', title: 'Scene 2', content: '', order: 2, sceneNumber: 2, createdAt: new Date(), updatedAt: new Date() }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterHeaderComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ChapterHeaderComponent);
    component = fixture.componentInstance;
    component.chapter = { ...mockChapter };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('display', () => {
    it('should show chapter number and title', () => {
      expect(component.chapter.chapterNumber).toBe(1);
      expect(component.chapter.title).toBe('Test Chapter');
    });

    it('should show scene count label with plural', () => {
      expect(component.sceneCountLabel).toBe('2 scenes');
    });

    it('should show scene count label with singular', () => {
      component.chapter = { ...mockChapter, scenes: [mockChapter.scenes[0]] };
      expect(component.sceneCountLabel).toBe('1 scene');
    });

    it('should show zero scenes', () => {
      component.chapter = { ...mockChapter, scenes: [] };
      expect(component.sceneCountLabel).toBe('0 scenes');
    });
  });

  describe('editing', () => {
    it('should enter edit mode when startEdit is called', () => {
      expect(component.editing()).toBeFalse();

      component.startEdit();

      expect(component.editing()).toBeTrue();
      expect(component.editValue()).toBe('Test Chapter');
    });

    it('should stop event propagation on startEdit', () => {
      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.startEdit(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should cancel edit mode', () => {
      component.startEdit();
      expect(component.editing()).toBeTrue();

      component.cancelEdit();

      expect(component.editing()).toBeFalse();
      expect(component.editValue()).toBe('');
    });

    it('should stop event propagation on cancelEdit', () => {
      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.cancelEdit(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should emit titleUpdate event on saveTitle', () => {
      spyOn(component.titleUpdate, 'emit');
      component.startEdit();
      component.editValue.set('New Chapter Title');

      component.saveTitle();

      expect(component.titleUpdate.emit).toHaveBeenCalledWith({
        chapterId: 'chapter-123',
        title: 'New Chapter Title'
      } as ChapterTitleUpdateEvent);
      expect(component.editing()).toBeFalse();
    });

    it('should not emit update for empty title', () => {
      spyOn(component.titleUpdate, 'emit');
      component.startEdit();
      component.editValue.set('   ');

      component.saveTitle();

      expect(component.titleUpdate.emit).not.toHaveBeenCalled();
    });

    it('should stop event propagation on saveTitle', () => {
      spyOn(component.titleUpdate, 'emit');
      component.editValue.set('Title');
      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.saveTitle(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('keyboard handling', () => {
    it('should save on Enter keydown', () => {
      spyOn(component, 'saveTitle');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      spyOn(event, 'preventDefault');
      spyOn(event, 'stopPropagation');

      component.onKeydown(event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.saveTitle).toHaveBeenCalled();
    });

    it('should cancel on Escape keydown', () => {
      spyOn(component, 'cancelEdit');
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      spyOn(event, 'stopPropagation');

      component.onKeydown(event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.cancelEdit).toHaveBeenCalled();
    });

    it('should stop propagation on input click', () => {
      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.onInputClick(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('untitled chapter', () => {
    it('should handle undefined title', () => {
      component.chapter = { ...mockChapter, title: '' };
      fixture.detectChanges();

      // Component should handle empty title gracefully
      expect(component.chapter.title).toBe('');
    });
  });
});
