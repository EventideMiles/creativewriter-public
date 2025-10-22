/**
 * Snapshot Service
 *
 * Queries snapshots from CouchDB via HTTP (snapshots are NOT synced to PouchDB)
 * Provides restore functionality and manual snapshot creation
 */

import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { DatabaseService } from '../../core/services/database.service';
import { Story, Chapter, StorySettings } from '../models/story.interface';

export interface StorySnapshot {
  _id: string;
  _rev?: string;
  type: 'story-snapshot';
  storyId: string;
  userId: string;
  createdAt: string;
  retentionTier: 'granular' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
  expiresAt?: string;
  snapshotType: 'auto' | 'manual';
  triggeredBy: 'scheduler' | 'user' | 'event';
  reason?: string;

  snapshot: {
    title: string;
    chapters: Chapter[];
    settings?: StorySettings;
    updatedAt: Date | string;
  };

  metadata: {
    wordCount: number;
    chapterCount: number;
    sceneCount: number;
  };
}

export interface SnapshotTimeline {
  recent: StorySnapshot[];    // Last 4 hours (15-min)
  hourly: StorySnapshot[];    // Last 24 hours
  daily: StorySnapshot[];     // Last 30 days
  weekly: StorySnapshot[];    // Last 12 weeks
  monthly: StorySnapshot[];   // Last 12 months
  manual: StorySnapshot[];    // User-created snapshots
}

@Injectable({
  providedIn: 'root'
})
export class SnapshotService {
  private readonly authService = inject(AuthService);
  private readonly databaseService = inject(DatabaseService);

  /**
   * Get CouchDB URL for direct HTTP queries
   */
  private getCouchDBUrl(): string {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    // Get current database name (user-specific)
    const db = this.databaseService.getDatabaseSync();
    const dbName = db ? db.name : 'creative-writer-stories-anonymous';

    // Use reverse proxy path
    const baseUrl = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    return `${baseUrl}/_db/${dbName}`;
  }

  /**
   * Get credentials for CouchDB access (same as sync)
   */
  private getCredentials() {
    return {
      username: 'admin',
      password: 'password' // TODO: Make configurable from settings
    };
  }

  /**
   * Create basic auth header
   */
  private getAuthHeader(): string {
    const credentials = this.getCredentials();
    return 'Basic ' + btoa(`${credentials.username}:${credentials.password}`);
  }

  /**
   * Fetch snapshots directly from CouchDB via HTTP
   */
  async getSnapshotsForStory(storyId: string): Promise<StorySnapshot[]> {
    const couchUrl = this.getCouchDBUrl();
    const authHeader = this.getAuthHeader();

    try {
      // Build query parameters with proper JSON encoding
      const startkey = JSON.stringify([storyId]);
      const endkey = JSON.stringify([storyId, {}]);

      // Query CouchDB view
      const response = await fetch(
        `${couchUrl}/_design/snapshots/_view/by_story_and_date?` +
        `startkey=${encodeURIComponent(startkey)}&` +
        `endkey=${encodeURIComponent(endkey)}&` +
        `include_docs=true&descending=true`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch snapshots: ${response.statusText}`);
      }

      const result = await response.json();
      return result.rows.map((row: { doc: StorySnapshot }) => row.doc);
    } catch (error) {
      console.error('[SnapshotService] Failed to fetch snapshots:', error);
      throw error;
    }
  }

  /**
   * Get organized snapshot timeline
   */
  async getSnapshotTimeline(storyId: string): Promise<SnapshotTimeline> {
    const snapshots = await this.getSnapshotsForStory(storyId);

    return {
      recent: snapshots.filter(s => s.retentionTier === 'granular'),
      hourly: snapshots.filter(s => s.retentionTier === 'hourly'),
      daily: snapshots.filter(s => s.retentionTier === 'daily'),
      weekly: snapshots.filter(s => s.retentionTier === 'weekly'),
      monthly: snapshots.filter(s => s.retentionTier === 'monthly'),
      manual: snapshots.filter(s => s.retentionTier === 'manual')
    };
  }

  /**
   * Get a single snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<StorySnapshot> {
    const couchUrl = this.getCouchDBUrl();
    const authHeader = this.getAuthHeader();

    try {
      const response = await fetch(`${couchUrl}/${snapshotId}`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch snapshot: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[SnapshotService] Failed to fetch snapshot:', error);
      throw error;
    }
  }

  /**
   * Restore story from snapshot
   */
  async restoreFromSnapshot(
    storyId: string,
    snapshotId: string,
    options: { createBackup?: boolean } = {}
  ): Promise<Story> {
    try {
      // Get local PouchDB (for story updates)
      const db = await this.databaseService.getDatabase();

      // Fetch snapshot from CouchDB via HTTP
      const snapshot = await this.getSnapshot(snapshotId);

      // Get current story from PouchDB
      const currentStory = await db.get(storyId) as Story;

      // Create backup snapshot if requested
      if (options.createBackup) {
        await this.createManualSnapshot(currentStory, `Backup before restore to ${snapshotId}`);
      }

      // Restore snapshot content to story
      const restoredStory: Story = {
        ...currentStory,  // Keep _id, _rev, etc.
        title: snapshot.snapshot.title,
        chapters: snapshot.snapshot.chapters,
        settings: snapshot.snapshot.settings,
        updatedAt: new Date()
      };

      // Update in PouchDB (will sync to CouchDB)
      await db.put(restoredStory);

      console.log('[SnapshotService] Story restored successfully from snapshot:', snapshotId);
      return restoredStory;
    } catch (error) {
      console.error('[SnapshotService] Failed to restore from snapshot:', error);
      throw error;
    }
  }

  /**
   * Create manual snapshot (written directly to CouchDB via HTTP)
   */
  async createManualSnapshot(story: Story, reason: string): Promise<void> {
    const couchUrl = this.getCouchDBUrl();
    const authHeader = this.getAuthHeader();

    const snapshot: Omit<StorySnapshot, '_rev'> = {
      _id: `snapshot-${story._id}-${Date.now()}-manual`,
      type: 'story-snapshot',
      storyId: story._id!,
      userId: this.extractUserId(),
      createdAt: new Date().toISOString(),
      retentionTier: 'manual',  // Manual snapshots never expire
      snapshotType: 'manual',
      triggeredBy: 'user',
      reason: reason,

      snapshot: {
        title: story.title,
        chapters: story.chapters,
        settings: story.settings,
        updatedAt: story.updatedAt
      },

      metadata: {
        wordCount: this.calculateWordCount(story),
        chapterCount: story.chapters.length,
        sceneCount: this.countScenes(story)
      }
    };

    try {
      // Write directly to CouchDB
      const response = await fetch(couchUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(snapshot)
      });

      if (!response.ok) {
        throw new Error(`Failed to create snapshot: ${response.statusText}`);
      }

      console.log('[SnapshotService] Manual snapshot created successfully');
    } catch (error) {
      console.error('[SnapshotService] Failed to create manual snapshot:', error);
      throw error;
    }
  }

  /**
   * Delete a snapshot (manual cleanup)
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const couchUrl = this.getCouchDBUrl();
    const authHeader = this.getAuthHeader();

    try {
      // Get snapshot to get _rev
      const snapshot = await this.getSnapshot(snapshotId);

      // Delete from CouchDB
      const response = await fetch(`${couchUrl}/${snapshotId}?rev=${snapshot._rev}`, {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete snapshot: ${response.statusText}`);
      }

      console.log('[SnapshotService] Snapshot deleted successfully:', snapshotId);
    } catch (error) {
      console.error('[SnapshotService] Failed to delete snapshot:', error);
      throw error;
    }
  }

  /**
   * Get count of snapshots for a story
   */
  async getSnapshotCount(storyId: string): Promise<number> {
    try {
      const snapshots = await this.getSnapshotsForStory(storyId);
      return snapshots.length;
    } catch (error) {
      console.error('[SnapshotService] Failed to get snapshot count:', error);
      return 0;
    }
  }

  /**
   * Check if snapshots are available (CouchDB connection)
   */
  async checkSnapshotAvailability(): Promise<boolean> {
    try {
      const couchUrl = this.getCouchDBUrl();
      const authHeader = this.getAuthHeader();

      const response = await fetch(`${couchUrl}/_design/snapshots`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch {
      console.warn('[SnapshotService] Snapshots not available (offline or no CouchDB connection)');
      return false;
    }
  }

  // Helper methods

  private extractUserId(): string {
    const user = this.authService.getCurrentUser();
    return user?.username || 'anonymous';
  }

  private calculateWordCount(story: Story): number {
    let total = 0;
    story.chapters.forEach(chapter => {
      chapter.scenes.forEach(scene => {
        const text = this.stripHtml(scene.content || '');
        total += text.trim().split(/\s+/).filter(w => w.length > 0).length;
      });
    });
    return total;
  }

  private countScenes(story: Story): number {
    return story.chapters.reduce((sum, ch) => sum + ch.scenes.length, 0);
  }

  private stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * Format timestamp for display
   */
  formatSnapshotTime(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)} day${Math.floor(diffMins / 1440) > 1 ? 's' : ''} ago`;

    return date.toLocaleString();
  }
}
