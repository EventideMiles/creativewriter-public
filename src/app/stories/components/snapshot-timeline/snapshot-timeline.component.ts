import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, AlertController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SnapshotService, SnapshotTimeline, StorySnapshot } from '../../services/snapshot.service';
import { StoryService } from '../../services/story.service';

@Component({
  selector: 'app-snapshot-timeline',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './snapshot-timeline.component.html',
  styleUrls: ['./snapshot-timeline.component.scss']
})
export class SnapshotTimelineComponent implements OnInit {
  @Input() storyId!: string;
  @Input() storyTitle = 'Story';

  timeline?: SnapshotTimeline;
  loading = true;
  error?: string;
  snapshotsAvailable = false;

  readonly snapshotService = inject(SnapshotService);
  private readonly storyService = inject(StoryService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly loadingCtrl = inject(LoadingController);

  async ngOnInit() {
    await this.loadTimeline();
  }

  async loadTimeline() {
    this.loading = true;
    this.error = undefined;

    try {
      // Check if snapshots are available (online + CouchDB)
      this.snapshotsAvailable = await this.snapshotService.checkSnapshotAvailability();

      if (!this.snapshotsAvailable) {
        this.error = 'Snapshots are not available. You need an internet connection to view version history.';
        this.loading = false;
        return;
      }

      this.timeline = await this.snapshotService.getSnapshotTimeline(this.storyId);
      this.loading = false;
    } catch (err) {
      console.error('Failed to load snapshots:', err);
      this.error = 'Failed to load version history. Please try again.';
      this.loading = false;
    }
  }

  async restore(snapshot: StorySnapshot) {
    const alert = await this.alertCtrl.create({
      header: 'Restore Version?',
      message: `This will restore your story to the version from ${this.snapshotService.formatSnapshotTime(snapshot.createdAt)}.

Your current version will be automatically backed up.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Restore',
          role: 'confirm',
          handler: async () => {
            await this.performRestore(snapshot);
          }
        }
      ]
    });

    await alert.present();
  }

  private async performRestore(snapshot: StorySnapshot) {
    const loading = await this.loadingCtrl.create({
      message: 'Restoring version...'
    });
    await loading.present();

    try {
      await this.snapshotService.restoreFromSnapshot(
        this.storyId,
        snapshot._id,
        { createBackup: true }
      );

      await loading.dismiss();

      const successAlert = await this.alertCtrl.create({
        header: 'Restored!',
        message: 'Your story has been restored to the selected version.',
        buttons: ['OK']
      });

      await successAlert.present();
      await this.close(true); // Close with reload flag
    } catch (err) {
      await loading.dismiss();
      console.error('Restore failed:', err);

      const errorAlert = await this.alertCtrl.create({
        header: 'Restore Failed',
        message: 'Failed to restore the version. Please try again.',
        buttons: ['OK']
      });

      await errorAlert.present();
    }
  }

  async createManualSnapshot() {
    const alert = await this.alertCtrl.create({
      header: 'Create Snapshot',
      message: 'Give this snapshot a name (optional):',
      inputs: [
        {
          name: 'reason',
          type: 'text',
          placeholder: 'e.g., "Before major rewrite"'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Create',
          handler: async (data) => {
            await this.performCreateSnapshot(data.reason || 'Manual snapshot');
          }
        }
      ]
    });

    await alert.present();
  }

  private async performCreateSnapshot(reason: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Creating snapshot...'
    });
    await loading.present();

    try {
      const story = await this.storyService.getStory(this.storyId);
      if (!story) {
        throw new Error('Story not found');
      }

      await this.snapshotService.createManualSnapshot(story, reason);
      await loading.dismiss();

      const successAlert = await this.alertCtrl.create({
        header: 'Snapshot Created!',
        message: 'Your manual snapshot has been created.',
        buttons: ['OK']
      });

      await successAlert.present();

      // Reload timeline
      await this.loadTimeline();
    } catch (err) {
      await loading.dismiss();
      console.error('Create snapshot failed:', err);

      const errorAlert = await this.alertCtrl.create({
        header: 'Failed',
        message: 'Failed to create snapshot. Please try again.',
        buttons: ['OK']
      });

      await errorAlert.present();
    }
  }

  getTotalSnapshotCount(): number {
    if (!this.timeline) return 0;
    return this.timeline.recent.length +
           this.timeline.hourly.length +
           this.timeline.daily.length +
           this.timeline.weekly.length +
           this.timeline.monthly.length +
           this.timeline.manual.length;
  }

  async close(shouldReload = false) {
    await this.modalCtrl.dismiss({ shouldReload });
  }
}
