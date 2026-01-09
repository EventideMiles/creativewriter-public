import { Injectable, inject } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { StoryEditorComponent } from '../components/story-editor/story-editor.component';
import { StoryService } from '../services/story.service';
import { DialogService } from '../../core/services/dialog.service';

@Injectable({ providedIn: 'root' })
export class StoryEditorExitGuard implements CanDeactivate<StoryEditorComponent> {
  private readonly storyService = inject(StoryService);
  private readonly dialogService = inject(DialogService);

  async canDeactivate(component: StoryEditorComponent): Promise<boolean> {
    try {
      // Offer deletion for empty, untitled default drafts on any route change
      if (typeof component.isDefaultEmptyDraft === 'function' && component.isDefaultEmptyDraft()) {
        const shouldDelete = await this.dialogService.confirmDestructive({
          header: 'Empty Draft',
          message: 'This draft has no title or content. Delete it?',
          confirmText: 'Delete'
        });
        if (shouldDelete) {
          try {
            await this.storyService.deleteStory(component.story.id);
          } catch (err) {
            console.error('Failed to delete empty draft via guard:', err);
          }
          // After deletion, continue navigation without further prompts
          return true;
        }
        // If user cancels deletion, fall through to unsaved-changes handling below
      }

      // Unsaved changes confirmation (outside of empty-draft deletion)
      if (component.hasUnsavedChanges) {
        const save = await this.dialogService.confirm({
          header: 'Unsaved Changes',
          message: 'You have unsaved changes. Save before leaving?',
          confirmText: 'Save',
          cancelText: 'Don\'t Save'
        });
        if (save) {
          try {
            await component.saveStory();
            return true;
          } catch (err) {
            console.error('Failed to save changes in guard:', err);
            const discard = await this.dialogService.confirmWarning({
              header: 'Save Failed',
              message: 'Save failed. Discard changes and leave?',
              confirmText: 'Discard & Leave',
              cancelText: 'Stay'
            });
            return discard;
          }
        } else {
          const discard = await this.dialogService.confirmWarning({
            header: 'Discard Changes',
            message: 'Discard changes and leave?',
            confirmText: 'Discard & Leave',
            cancelText: 'Stay'
          });
          return discard;
        }
      }
    } catch (err) {
      // Non-blocking guard: always allow navigation
      console.warn('StoryEditorExitGuard encountered an issue:', err);
    }

    return true;
  }
}
