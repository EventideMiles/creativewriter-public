import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DatabaseService } from '../../core/services/database.service';
import { ImageService } from './image.service';
import { VideoService } from './video.service';
import { StoryService } from '../../stories/services/story.service';
import { StoredImage } from './image.service';
import { ImageVideoAssociation } from '../models/video.interface';

export interface OrphanedImage {
  id: string;
  name: string;
  size: number;
  createdAt: Date;
  base64Data: string;
  mimeType: string;
}

export interface OrphanedVideo {
  id: string;
  name: string;
  size: number;
  createdAt: Date;
  base64Data: string;
  mimeType: string;
}

export interface DatabaseStats {
  totalImages: number;
  totalVideos: number;
  totalStories: number;
  orphanedImages: number;
  orphanedVideos: number;
  totalImageSize: number;
  totalVideoSize: number;
  orphanedImageSize: number;
  orphanedVideoSize: number;
  databaseSizeEstimate: number;
}

export interface DuplicateImage {
  originalId: string;
  duplicateIds: string[];
  name: string;
  size: number;
  base64Data: string;
}

export interface IntegrityIssue {
  type: 'missing_chapters' | 'missing_scenes' | 'corrupt_data' | 'invalid_references';
  storyId: string;
  storyTitle: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RemoteScanProgress {
  phase: 'fetching-images' | 'fetching-stories' | 'analyzing-content' | 'comparing' | 'complete';
  current: number;
  total: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class DbMaintenanceService {
  private readonly databaseService = inject(DatabaseService);
  private readonly imageService = inject(ImageService);
  private readonly videoService = inject(VideoService);
  private readonly storyService = inject(StoryService);

  private operationProgress = new BehaviorSubject<{ operation: string; progress: number; message: string }>({
    operation: '',
    progress: 0,
    message: ''
  });

  public operationProgress$ = this.operationProgress.asObservable();

  constructor() {
    // Service initialization
  }

  private updateProgress(operation: string, progress: number, message: string): void {
    this.operationProgress.next({ operation, progress, message });
  }

  /**
   * Finds all orphaned images that are not referenced in any story content
   */
  async findOrphanedImages(): Promise<OrphanedImage[]> {
    this.updateProgress('orphaned-scan', 0, 'Loading all images...');
    
    try {
      // Get all images from database
      const allImages = await this.imageService.getAllImages();
      this.updateProgress('orphaned-scan', 20, `${allImages.length} images found`);

      // Get all stories
      const allStories = await this.storyService.getAllStories();
      this.updateProgress('orphaned-scan', 40, `${allStories.length} stories found`);

      // Extract all base64 image data from story content
      const usedImageData = new Set<string>();
      let processedStories = 0;

      for (const story of allStories) {
        for (const chapter of story.chapters) {
          for (const scene of chapter.scenes) {
            const base64Matches = scene.content.match(/<img[^>]*src="data:image\/[^;]+;base64,([^"]+)"/gi);
            if (base64Matches) {
              base64Matches.forEach(match => {
                const base64Data = match.match(/base64,([^"]+)/)?.[1];
                if (base64Data) {
                  usedImageData.add(base64Data);
                }
              });
            }
          }
        }
        processedStories++;
        this.updateProgress('orphaned-scan', 40 + (processedStories / allStories.length) * 40, 
          `Processing story ${processedStories}/${allStories.length}`);
      }

      this.updateProgress('orphaned-scan', 80, 'Analyzing orphaned images...');

      // Find orphaned images by checking if their base64 data is used
      const orphanedImages: OrphanedImage[] = [];
      let processedImages = 0;

      for (const image of allImages) {
        if (!usedImageData.has(image.base64Data)) {
          orphanedImages.push({
            id: image.id,
            name: image.name,
            size: image.size,
            createdAt: image.createdAt,
            base64Data: image.base64Data,
            mimeType: image.mimeType
          });
        }
        processedImages++;
        this.updateProgress('orphaned-scan', 80 + (processedImages / allImages.length) * 20, 
          `Analyzing image ${processedImages}/${allImages.length}`);
      }

      this.updateProgress('orphaned-scan', 100, `${orphanedImages.length} orphaned images found`);

      return orphanedImages;
    } catch (error) {
      console.error('Error finding orphaned images:', error);
      this.updateProgress('orphaned-scan', 0, 'Error scanning orphaned images');
      throw error;
    }
  }

  /**
   * Finds orphaned images by scanning the REMOTE CouchDB database directly.
   * This ensures all stories are checked, not just locally synced ones.
   *
   * @param progressCallback Optional callback for progress updates
   * @returns Promise<OrphanedImage[]> List of orphaned images found
   * @throws Error if remote database is not connected
   */
  async findOrphanedImagesFromRemote(
    progressCallback?: (progress: RemoteScanProgress) => void
  ): Promise<OrphanedImage[]> {
    const updateProgress = (phase: RemoteScanProgress['phase'], current: number, total: number, message: string) => {
      if (progressCallback) {
        progressCallback({ phase, current, total, message });
      }
    };

    try {
      // Get remote database
      const remoteDb = this.databaseService.getRemoteDatabase();
      if (!remoteDb) {
        throw new Error('Remote database not connected. Please enable sync in Settings.');
      }

      // Phase 1: Fetch all images from remote
      updateProgress('fetching-images', 0, 100, 'Loading images from remote database...');

      const imageResult = await remoteDb.find({
        selector: { type: 'image' }
      });

      const allImages = imageResult.docs as (StoredImage & { _id: string; _rev: string })[];
      updateProgress('fetching-images', 100, 100, `${allImages.length} images found`);

      if (allImages.length === 0) {
        updateProgress('complete', 100, 100, 'No images found in database');
        return [];
      }

      // Phase 2: Fetch all stories from remote
      updateProgress('fetching-stories', 0, 100, 'Loading stories from remote database...');

      const allDocsResult = await remoteDb.allDocs({ include_docs: true });

      // Filter to get story documents (have chapters field and not starting with _)
      interface StoryDoc {
        _id: string;
        chapters?: {
          scenes?: {
            content?: string;
          }[];
        }[];
      }

      const allStories = allDocsResult.rows
        .filter(row => {
          if (!row.doc || row.id.startsWith('_')) return false;
          const doc = row.doc as StoryDoc;
          return doc.chapters && Array.isArray(doc.chapters);
        })
        .map(row => row.doc as StoryDoc);

      updateProgress('fetching-stories', 100, 100, `${allStories.length} stories found`);

      // Phase 3: Extract all base64 image data from story content
      updateProgress('analyzing-content', 0, allStories.length, 'Analyzing story content...');

      const usedImageData = new Set<string>();
      let processedStories = 0;

      for (const story of allStories) {
        if (story.chapters) {
          for (const chapter of story.chapters) {
            if (chapter.scenes) {
              for (const scene of chapter.scenes) {
                if (scene.content) {
                  const base64Matches = scene.content.match(/<img[^>]*src="data:image\/[^;]+;base64,([^"]+)"/gi);
                  if (base64Matches) {
                    base64Matches.forEach(match => {
                      const base64Data = match.match(/base64,([^"]+)/)?.[1];
                      if (base64Data) {
                        usedImageData.add(base64Data);
                      }
                    });
                  }
                }
              }
            }
          }
        }
        processedStories++;
        updateProgress('analyzing-content', processedStories, allStories.length,
          `Processing story ${processedStories}/${allStories.length}`);
      }

      // Phase 4: Compare stored images against used images
      updateProgress('comparing', 0, allImages.length, 'Identifying orphaned images...');

      const orphanedImages: OrphanedImage[] = [];
      let processedImages = 0;

      for (const image of allImages) {
        if (!usedImageData.has(image.base64Data)) {
          orphanedImages.push({
            id: image.id,
            name: image.name,
            size: image.size,
            createdAt: image.createdAt,
            base64Data: image.base64Data,
            mimeType: image.mimeType
          });
        }
        processedImages++;
        updateProgress('comparing', processedImages, allImages.length,
          `Analyzing image ${processedImages}/${allImages.length}`);
      }

      updateProgress('complete', 100, 100, `${orphanedImages.length} orphaned images found`);

      return orphanedImages;
    } catch (error) {
      console.error('Error finding orphaned images from remote:', error);
      throw error;
    }
  }

  /**
   * Finds all orphaned videos that are not associated with any images
   */
  async findOrphanedVideos(): Promise<OrphanedVideo[]> {
    this.updateProgress('orphaned-video-scan', 0, 'Loading all videos...');
    
    try {
      // Get all videos from database
      const allVideos = await this.videoService.getAllVideos();
      this.updateProgress('orphaned-video-scan', 30, `${allVideos.length} videos found`);

      // Get all image-video associations
      const db = await this.databaseService.getDatabase();
      const associationsResult = await db.find({
        selector: { type: 'image-video-association' }
      });
      
      this.updateProgress('orphaned-video-scan', 60, `${associationsResult.docs.length} associations found`);

      // Extract video IDs that are associated with images
      const associatedVideoIds = new Set<string>();
      associationsResult.docs.forEach((doc: unknown) => {
        const assoc = doc as ImageVideoAssociation & { _id: string; _rev: string };
        if (assoc.videoId) {
          associatedVideoIds.add(assoc.videoId);
        }
      });

      // Find orphaned videos by checking if they are associated
      const orphanedVideos: OrphanedVideo[] = [];
      let processedVideos = 0;

      for (const video of allVideos) {
        if (!associatedVideoIds.has(video.id)) {
          orphanedVideos.push({
            id: video.id,
            name: video.name,
            size: video.size,
            createdAt: video.createdAt,
            base64Data: video.base64Data,
            mimeType: video.mimeType
          });
        }
        processedVideos++;
        this.updateProgress('orphaned-video-scan', 60 + (processedVideos / allVideos.length) * 40, 
          `Analyzing video ${processedVideos}/${allVideos.length}`);
      }

      this.updateProgress('orphaned-video-scan', 100, `${orphanedVideos.length} orphaned videos found`);
      
      return orphanedVideos;
    } catch (error) {
      console.error('Error finding orphaned videos:', error);
      this.updateProgress('orphaned-video-scan', 0, 'Error scanning orphaned videos');
      throw error;
    }
  }

  /**
   * Deletes orphaned images by their IDs
   */
  async deleteOrphanedImages(imageIds: string[]): Promise<number> {
    this.updateProgress('delete-images', 0, `Deleting ${imageIds.length} images...`);
    
    let deletedCount = 0;
    
    for (let i = 0; i < imageIds.length; i++) {
      try {
        await this.imageService.deleteImage(imageIds[i]);
        deletedCount++;
        this.updateProgress('delete-images', ((i + 1) / imageIds.length) * 100, 
          `Deleted: ${deletedCount}/${imageIds.length}`);
      } catch (error) {
        console.error(`Failed to delete image ${imageIds[i]}:`, error);
      }
    }

    this.updateProgress('delete-images', 100, `${deletedCount} images successfully deleted`);
    return deletedCount;
  }

  /**
   * Deletes orphaned images directly from the REMOTE CouchDB database.
   * Changes will automatically sync to local database.
   *
   * @param imageIds Array of image IDs (without the 'image_' prefix) to delete
   * @param progressCallback Optional callback for progress updates
   * @returns Promise<number> Count of successfully deleted images
   * @throws Error if remote database is not connected
   */
  async deleteOrphanedImagesFromRemote(
    imageIds: string[],
    progressCallback?: (progress: { current: number; total: number }) => void
  ): Promise<number> {
    // Get remote database
    const remoteDb = this.databaseService.getRemoteDatabase();
    if (!remoteDb) {
      throw new Error('Remote database not connected. Please enable sync in Settings.');
    }

    let deletedCount = 0;

    for (let i = 0; i < imageIds.length; i++) {
      try {
        // Get the document from remote (image IDs are stored with 'image_' prefix in _id)
        const docId = imageIds[i].startsWith('image_') ? imageIds[i] : `image_${imageIds[i]}`;
        const doc = await remoteDb.get(docId) as { _id: string; _rev: string };

        // Delete from remote
        await remoteDb.remove(doc._id, doc._rev);
        deletedCount++;

        if (progressCallback) {
          progressCallback({ current: i + 1, total: imageIds.length });
        }
      } catch (error) {
        console.error(`Failed to delete image ${imageIds[i]} from remote:`, error);
        // Continue with remaining images
      }
    }

    return deletedCount;
  }

  /**
   * Finds duplicate images by scanning the REMOTE CouchDB database directly.
   *
   * @param progressCallback Optional callback for progress updates
   * @returns Promise<DuplicateImage[]> List of duplicate image groups found
   * @throws Error if remote database is not connected
   */
  async findDuplicateImagesFromRemote(
    progressCallback?: (progress: RemoteScanProgress) => void
  ): Promise<DuplicateImage[]> {
    const updateProgress = (phase: RemoteScanProgress['phase'], current: number, total: number, message: string) => {
      if (progressCallback) {
        progressCallback({ phase, current, total, message });
      }
    };

    try {
      const remoteDb = this.databaseService.getRemoteDatabase();
      if (!remoteDb) {
        throw new Error('Remote database not connected. Please enable sync in Settings.');
      }

      // Phase 1: Fetch all images from remote
      updateProgress('fetching-images', 0, 100, 'Loading images from remote database...');

      const imageResult = await remoteDb.find({
        selector: { type: 'image' }
      });

      const allImages = imageResult.docs as (StoredImage & { _id: string; _rev: string })[];
      updateProgress('fetching-images', 100, 100, `${allImages.length} images found`);

      if (allImages.length === 0) {
        updateProgress('complete', 100, 100, 'No images found in database');
        return [];
      }

      // Phase 2: Group images by base64 content
      updateProgress('analyzing-content', 0, allImages.length, 'Analyzing image content...');

      const duplicates: DuplicateImage[] = [];
      const base64Map = new Map<string, (StoredImage & { _id: string; _rev: string })[]>();

      for (let i = 0; i < allImages.length; i++) {
        const image = allImages[i];
        const existing = base64Map.get(image.base64Data) || [];
        existing.push(image);
        base64Map.set(image.base64Data, existing);
        updateProgress('analyzing-content', i + 1, allImages.length, `Processing image ${i + 1}/${allImages.length}`);
      }

      // Phase 3: Identify duplicates
      updateProgress('comparing', 0, base64Map.size, 'Identifying duplicates...');

      let processed = 0;
      for (const [, images] of base64Map) {
        if (images.length > 1) {
          const [original, ...duplicateImages] = images.sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          duplicates.push({
            originalId: original.id,
            duplicateIds: duplicateImages.map(img => img.id),
            name: original.name,
            size: original.size,
            base64Data: original.base64Data
          });
        }
        processed++;
        updateProgress('comparing', processed, base64Map.size, `Comparing ${processed}/${base64Map.size}`);
      }

      updateProgress('complete', 100, 100, `${duplicates.length} duplicate groups found`);

      return duplicates;
    } catch (error) {
      console.error('Error finding duplicate images from remote:', error);
      throw error;
    }
  }

  /**
   * Deletes duplicate images directly from the REMOTE CouchDB database.
   *
   * @param duplicates Array of DuplicateImage objects to process
   * @param progressCallback Optional callback for progress updates
   * @returns Promise<number> Count of successfully deleted images
   * @throws Error if remote database is not connected
   */
  async deleteDuplicateImagesFromRemote(
    duplicates: DuplicateImage[],
    progressCallback?: (progress: { current: number; total: number }) => void
  ): Promise<number> {
    const remoteDb = this.databaseService.getRemoteDatabase();
    if (!remoteDb) {
      throw new Error('Remote database not connected. Please enable sync in Settings.');
    }

    let deletedCount = 0;
    const totalToDelete = duplicates.reduce((sum, dup) => sum + dup.duplicateIds.length, 0);
    let processed = 0;

    for (const duplicate of duplicates) {
      for (const duplicateId of duplicate.duplicateIds) {
        try {
          const docId = duplicateId.startsWith('image_') ? duplicateId : `image_${duplicateId}`;
          const doc = await remoteDb.get(docId) as { _id: string; _rev: string };
          await remoteDb.remove(doc._id, doc._rev);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete duplicate image ${duplicateId} from remote:`, error);
        }
        processed++;
        if (progressCallback) {
          progressCallback({ current: processed, total: totalToDelete });
        }
      }
    }

    return deletedCount;
  }

  /**
   * Checks story integrity by scanning the REMOTE CouchDB database directly.
   *
   * @param progressCallback Optional callback for progress updates
   * @returns Promise<IntegrityIssue[]> List of integrity issues found
   * @throws Error if remote database is not connected
   */
  async checkStoryIntegrityFromRemote(
    progressCallback?: (progress: RemoteScanProgress) => void
  ): Promise<IntegrityIssue[]> {
    const updateProgress = (phase: RemoteScanProgress['phase'], current: number, total: number, message: string) => {
      if (progressCallback) {
        progressCallback({ phase, current, total, message });
      }
    };

    try {
      const remoteDb = this.databaseService.getRemoteDatabase();
      if (!remoteDb) {
        throw new Error('Remote database not connected. Please enable sync in Settings.');
      }

      // Phase 1: Fetch all stories from remote
      updateProgress('fetching-stories', 0, 100, 'Loading stories from remote database...');

      const allDocsResult = await remoteDb.allDocs({ include_docs: true });

      interface StoryDoc {
        _id: string;
        id?: string;
        title?: string;
        createdAt?: string;
        updatedAt?: string;
        chapters?: {
          title?: string;
          scenes?: unknown[];
        }[];
      }

      const allStories = allDocsResult.rows
        .filter(row => {
          if (!row.doc || row.id.startsWith('_')) return false;
          const doc = row.doc as StoryDoc;
          return doc.chapters && Array.isArray(doc.chapters);
        })
        .map(row => row.doc as StoryDoc);

      updateProgress('fetching-stories', 100, 100, `${allStories.length} stories found`);

      // Phase 2: Check each story for integrity issues
      updateProgress('analyzing-content', 0, allStories.length, 'Checking story integrity...');

      const issues: IntegrityIssue[] = [];
      let processedCount = 0;

      for (const story of allStories) {
        // Check for missing chapters
        if (!story.chapters || story.chapters.length === 0) {
          issues.push({
            type: 'missing_chapters',
            storyId: story.id || story._id,
            storyTitle: story.title || 'Untitled Story',
            description: 'Story has no chapters',
            severity: 'high'
          });
        } else {
          // Check each chapter for missing scenes
          for (const chapter of story.chapters) {
            if (!chapter.scenes || chapter.scenes.length === 0) {
              issues.push({
                type: 'missing_scenes',
                storyId: story.id || story._id,
                storyTitle: story.title || 'Untitled Story',
                description: `Chapter "${chapter.title || 'Untitled'}" has no scenes`,
                severity: 'medium'
              });
            }
          }
        }

        // Check for corrupt data (basic validation)
        if (!story._id || !story.createdAt || !story.updatedAt) {
          issues.push({
            type: 'corrupt_data',
            storyId: story.id || story._id || 'unknown',
            storyTitle: story.title || 'Untitled Story',
            description: 'Story has missing or corrupt metadata',
            severity: 'high'
          });
        }

        processedCount++;
        updateProgress('analyzing-content', processedCount, allStories.length,
          `Checking story ${processedCount}/${allStories.length}`);
      }

      updateProgress('complete', 100, 100, `${issues.length} integrity issues found`);

      return issues;
    } catch (error) {
      console.error('Error checking story integrity from remote:', error);
      throw error;
    }
  }

  /**
   * Gets database statistics from the REMOTE CouchDB database directly.
   *
   * @param progressCallback Optional callback for progress updates
   * @returns Promise<DatabaseStats> Database statistics
   * @throws Error if remote database is not connected
   */
  async getDatabaseStatsFromRemote(
    progressCallback?: (progress: RemoteScanProgress) => void
  ): Promise<DatabaseStats> {
    const updateProgress = (phase: RemoteScanProgress['phase'], current: number, total: number, message: string) => {
      if (progressCallback) {
        progressCallback({ phase, current, total, message });
      }
    };

    try {
      const remoteDb = this.databaseService.getRemoteDatabase();
      if (!remoteDb) {
        throw new Error('Remote database not connected. Please enable sync in Settings.');
      }

      // Phase 1: Fetch all documents from remote
      updateProgress('fetching-images', 0, 100, 'Loading database contents...');

      const allDocsResult = await remoteDb.allDocs({ include_docs: true });

      // Categorize documents
      const images: (StoredImage & { _id: string })[] = [];
      const videos: { size: number }[] = [];
      interface StoryDoc {
        chapters?: {
          scenes?: { content?: string }[];
        }[];
      }
      const stories: StoryDoc[] = [];

      for (const row of allDocsResult.rows) {
        if (!row.doc || row.id.startsWith('_')) continue;

        const doc = row.doc as { type?: string; chapters?: unknown[]; size?: number };

        if (doc.type === 'image') {
          images.push(row.doc as StoredImage & { _id: string });
        } else if (doc.type === 'video') {
          videos.push({ size: doc.size || 0 });
        } else if (doc.chapters && Array.isArray(doc.chapters)) {
          stories.push(row.doc as StoryDoc);
        }
      }

      updateProgress('fetching-images', 100, 100, `Found ${images.length} images, ${stories.length} stories`);

      // Phase 2: Find orphaned images
      updateProgress('analyzing-content', 0, stories.length, 'Analyzing content for orphaned images...');

      const usedImageData = new Set<string>();
      let processedStories = 0;

      for (const story of stories) {
        if (story.chapters) {
          for (const chapter of story.chapters) {
            if (chapter.scenes) {
              for (const scene of chapter.scenes) {
                if (scene.content) {
                  const base64Matches = scene.content.match(/<img[^>]*src="data:image\/[^;]+;base64,([^"]+)"/gi);
                  if (base64Matches) {
                    base64Matches.forEach(match => {
                      const base64Data = match.match(/base64,([^"]+)/)?.[1];
                      if (base64Data) {
                        usedImageData.add(base64Data);
                      }
                    });
                  }
                }
              }
            }
          }
        }
        processedStories++;
        updateProgress('analyzing-content', processedStories, stories.length,
          `Processing story ${processedStories}/${stories.length}`);
      }

      // Phase 3: Calculate statistics
      updateProgress('comparing', 0, 100, 'Calculating statistics...');

      let orphanedImageCount = 0;
      let orphanedImageSize = 0;
      let embeddedImageCount = 0;
      let embeddedImageSize = 0;

      // Count orphaned images
      for (const image of images) {
        if (!usedImageData.has(image.base64Data)) {
          orphanedImageCount++;
          orphanedImageSize += image.size;
        }
      }

      // Count embedded images
      for (const story of stories) {
        if (story.chapters) {
          for (const chapter of story.chapters) {
            if (chapter.scenes) {
              for (const scene of chapter.scenes) {
                if (scene.content) {
                  const base64Regex = /<img[^>]*src="data:image\/([^;]+);base64,([^"]+)"/gi;
                  let match;
                  while ((match = base64Regex.exec(scene.content)) !== null) {
                    embeddedImageCount++;
                    embeddedImageSize += Math.round(match[2].length * 0.75);
                  }
                }
              }
            }
          }
        }
      }

      const totalImages = images.length + embeddedImageCount;
      const standaloneImageSize = images.reduce((sum, img) => sum + img.size, 0);
      const totalImageSize = standaloneImageSize + embeddedImageSize;
      const totalVideos = videos.length;
      const totalVideoSize = videos.reduce((sum, vid) => sum + vid.size, 0);
      const avgStorySize = 50000;
      const databaseSizeEstimate = totalImageSize + totalVideoSize + (stories.length * avgStorySize);

      updateProgress('complete', 100, 100, 'Statistics calculated');

      return {
        totalImages,
        totalVideos,
        totalStories: stories.length,
        orphanedImages: orphanedImageCount,
        orphanedVideos: 0, // Would need separate video analysis
        totalImageSize,
        totalVideoSize,
        orphanedImageSize,
        orphanedVideoSize: 0,
        databaseSizeEstimate
      };
    } catch (error) {
      console.error('Error getting database stats from remote:', error);
      throw error;
    }
  }

  /**
   * Deletes orphaned videos by their IDs
   */
  async deleteOrphanedVideos(videoIds: string[]): Promise<number> {
    this.updateProgress('delete-videos', 0, `Deleting ${videoIds.length} videos...`);
    
    let deletedCount = 0;
    
    for (let i = 0; i < videoIds.length; i++) {
      try {
        await this.videoService.deleteVideo(videoIds[i]);
        deletedCount++;
        this.updateProgress('delete-videos', ((i + 1) / videoIds.length) * 100, 
          `Deleted: ${deletedCount}/${videoIds.length}`);
      } catch (error) {
        console.error(`Failed to delete video ${videoIds[i]}:`, error);
      }
    }

    this.updateProgress('delete-videos', 100, `${deletedCount} videos successfully deleted`);
    return deletedCount;
  }

  /**
   * Safely gets storage estimate with feature detection
   * Returns { usage: 0, quota: 0 } if Storage API is not available
   */
  private async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      } catch {
        return { usage: 0, quota: 0 };
      }
    }
    return { usage: 0, quota: 0 };
  }

  /**
   * Compacts the PouchDB database to reduce size
   * Returns actual bytes freed using navigator.storage.estimate()
   */
  async compactDatabase(): Promise<{ sizeBefore: number; sizeAfter: number; saved: number }> {
    this.updateProgress('compact', 0, 'Analyzing storage usage...');

    try {
      const db = await this.databaseService.getDatabase();

      // Get actual storage size before compaction
      const storageBefore = await this.getStorageEstimate();
      const sizeBefore = storageBefore.usage;

      if (sizeBefore > 0) {
        this.updateProgress('compact', 10, `Current usage: ${this.formatBytes(sizeBefore)}`);
      }

      this.updateProgress('compact', 20, 'Compacting database...');

      // Compact database to remove deleted document revisions
      await db.compact();

      // Try to clean up orphaned view data, but don't fail if it crashes
      // (can be memory-intensive on large databases)
      try {
        this.updateProgress('compact', 50, 'Cleaning up orphaned views...');
        await db.viewCleanup();
      } catch (viewCleanupError) {
        console.warn('viewCleanup failed (may be too memory-intensive):', viewCleanupError);
        this.updateProgress('compact', 60, 'View cleanup skipped (database too large)');
      }

      this.updateProgress('compact', 80, 'Measuring storage freed...');

      // Get actual storage size after compaction
      const storageAfter = await this.getStorageEstimate();
      const sizeAfter = storageAfter.usage;
      const saved = sizeBefore - sizeAfter;

      const message = sizeBefore > 0 && sizeAfter > 0
        ? (saved > 0
            ? `Freed ${this.formatBytes(saved)} (${this.formatBytes(sizeBefore)} → ${this.formatBytes(sizeAfter)})`
            : `Storage unchanged at ${this.formatBytes(sizeAfter)}`)
        : 'Compaction complete';

      this.updateProgress('compact', 100, message);

      return {
        sizeBefore,
        sizeAfter,
        saved
      };
    } catch (error) {
      console.error('Error compacting database:', error);
      this.updateProgress('compact', 0, 'Error compacting database');
      throw error;
    }
  }

  /**
   * Aggressively cleans storage by deleting all PouchDB index databases.
   * This is safe because indexes will be recreated automatically when needed.
   * Much more memory-efficient than compact() for very large databases.
   */
  async deepClean(): Promise<{ sizeBefore: number; sizeAfter: number; saved: number; deletedDatabases: number }> {
    this.updateProgress('rebuild', 0, 'Starting deep clean...');

    try {
      // Get storage before
      const storageBefore = await this.getStorageEstimate();
      const sizeBefore = storageBefore.usage;

      if (sizeBefore > 0) {
        this.updateProgress('rebuild', 5, `Current usage: ${this.formatBytes(sizeBefore)}`);
      }

      let deletedCount = 0;

      // Step 1: Delete all mrview (index) databases from IndexedDB
      // These can be huge and are safely recreatable
      this.updateProgress('rebuild', 10, 'Finding index databases to clean...');

      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          const mrviewDbs = databases.filter(db =>
            db.name && db.name.includes('-mrview-')
          );

          this.updateProgress('rebuild', 15, `Found ${mrviewDbs.length} index databases to delete`);

          for (let i = 0; i < mrviewDbs.length; i++) {
            const dbName = mrviewDbs[i].name;
            if (dbName) {
              try {
                await new Promise<void>((resolve, reject) => {
                  const request = indexedDB.deleteDatabase(dbName);
                  request.onsuccess = () => resolve();
                  request.onerror = () => reject(request.error);
                  request.onblocked = () => {
                    console.warn(`Database ${dbName} is blocked, skipping`);
                    resolve();
                  };
                });
                deletedCount++;
              } catch (e) {
                console.warn(`Failed to delete ${dbName}:`, e);
              }
            }

            // Progress from 15% to 60%
            const progress = 15 + Math.floor((i / mrviewDbs.length) * 45);
            this.updateProgress('rebuild', progress, `Deleted ${i + 1} / ${mrviewDbs.length} index databases`);

            // Small delay to prevent blocking
            if (i % 5 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        } catch (e) {
          console.warn('indexedDB.databases() not supported or failed:', e);
        }
      }

      // Step 2: Try compact on the main database (may fail on mobile, that's ok)
      this.updateProgress('rebuild', 65, 'Attempting database compaction...');
      try {
        const db = await this.databaseService.getDatabase();
        await db.compact();
        this.updateProgress('rebuild', 85, 'Compaction complete');
      } catch (compactError) {
        console.warn('Compact failed (expected on mobile with large DB):', compactError);
        this.updateProgress('rebuild', 85, 'Compaction skipped (too large for mobile)');
      }

      // Wait for IndexedDB to settle
      this.updateProgress('rebuild', 90, 'Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Measure final size
      const storageAfter = await this.getStorageEstimate();
      const sizeAfter = storageAfter.usage;
      const saved = sizeBefore - sizeAfter;

      const message = sizeBefore > 0 && sizeAfter > 0
        ? (saved > 0
            ? `Freed ${this.formatBytes(saved)} (${this.formatBytes(sizeBefore)} → ${this.formatBytes(sizeAfter)})`
            : `Storage: ${this.formatBytes(sizeAfter)} (deleted ${deletedCount} index DBs)`)
        : `Deleted ${deletedCount} index databases`;

      this.updateProgress('rebuild', 100, message);

      return {
        sizeBefore,
        sizeAfter,
        saved,
        deletedDatabases: deletedCount
      };
    } catch (error) {
      console.error('Error during deep clean:', error);
      this.updateProgress('rebuild', 0, 'Error during deep clean');
      throw error;
    }
  }

  /**
   * Gets current storage usage information
   */
  async getStorageUsage(): Promise<{ used: number; quota: number; percentage: number; formatted: string }> {
    const estimate = await this.getStorageEstimate();
    const used = estimate.usage;
    const quota = estimate.quota;
    const percentage = quota > 0 ? (used / quota) * 100 : 0;

    return {
      used,
      quota,
      percentage,
      formatted: quota > 0
        ? `${this.formatBytes(used)} / ${this.formatBytes(quota)} (${percentage.toFixed(1)}%)`
        : 'Storage API not available'
    };
  }

  /**
   * Finds duplicate images based on base64 content
   */
  async findDuplicateImages(): Promise<DuplicateImage[]> {
    this.updateProgress('duplicates', 0, 'Loading all images...');
    
    try {
      const allImages = await this.imageService.getAllImages();
      this.updateProgress('duplicates', 30, `${allImages.length} images loaded`);

      const duplicates: DuplicateImage[] = [];
      const base64Map = new Map<string, StoredImage[]>();

      // Group images by base64 content
      this.updateProgress('duplicates', 50, 'Grouping images by content...');
      
      for (const image of allImages) {
        const existing = base64Map.get(image.base64Data) || [];
        existing.push(image);
        base64Map.set(image.base64Data, existing);
      }

      // Find duplicates
      this.updateProgress('duplicates', 80, 'Identifying duplicates...');
      
      for (const [, images] of base64Map) {
        if (images.length > 1) {
          const [original, ...duplicateImages] = images.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          
          duplicates.push({
            originalId: original.id,
            duplicateIds: duplicateImages.map(img => img.id),
            name: original.name,
            size: original.size,
            base64Data: original.base64Data
          });
        }
      }

      this.updateProgress('duplicates', 100, `${duplicates.length} duplicates found`);
      
      return duplicates;
    } catch (error) {
      console.error('Error finding duplicate images:', error);
      this.updateProgress('duplicates', 0, 'Error finding duplicates');
      throw error;
    }
  }

  /**
   * Deletes duplicate images, keeping only the original
   */
  async deleteDuplicateImages(duplicates: DuplicateImage[]): Promise<number> {
    this.updateProgress('delete-duplicates', 0, 'Deleting duplicates...');
    
    let deletedCount = 0;
    const totalToDelete = duplicates.reduce((sum, dup) => sum + dup.duplicateIds.length, 0);

    for (const duplicate of duplicates) {
      for (const duplicateId of duplicate.duplicateIds) {
        try {
          await this.imageService.deleteImage(duplicateId);
          deletedCount++;
          this.updateProgress('delete-duplicates', (deletedCount / totalToDelete) * 100, 
            `Deleted: ${deletedCount}/${totalToDelete}`);
        } catch (error) {
          console.error(`Failed to delete duplicate image ${duplicateId}:`, error);
        }
      }
    }

    this.updateProgress('delete-duplicates', 100, `${deletedCount} duplicates deleted`);
    return deletedCount;
  }

  /**
   * Checks story integrity and finds issues
   */
  async checkStoryIntegrity(): Promise<IntegrityIssue[]> {
    this.updateProgress('integrity', 0, 'Loading all stories...');
    
    try {
      const allStories = await this.storyService.getAllStories();
      this.updateProgress('integrity', 20, `${allStories.length} stories loaded`);

      const issues: IntegrityIssue[] = [];
      let processedCount = 0;

      for (const story of allStories) {
        // Check for missing chapters
        if (!story.chapters || story.chapters.length === 0) {
          issues.push({
            type: 'missing_chapters',
            storyId: story.id,
            storyTitle: story.title || 'Untitled Story',
            description: 'Story has no chapters',
            severity: 'high'
          });
        } else {
          // Check each chapter for missing scenes
          for (const chapter of story.chapters) {
            if (!chapter.scenes || chapter.scenes.length === 0) {
              issues.push({
                type: 'missing_scenes',
                storyId: story.id,
                storyTitle: story.title || 'Untitled Story',
                description: `Chapter "${chapter.title}" has no scenes`,
                severity: 'medium'
              });
            }
          }
        }

        // Check for corrupt data (basic validation)
        if (!story.id || !story.createdAt || !story.updatedAt) {
          issues.push({
            type: 'corrupt_data',
            storyId: story.id || 'unknown',
            storyTitle: story.title || 'Untitled Story',
            description: 'Story has missing or corrupt metadata',
            severity: 'high'
          });
        }

        processedCount++;
        this.updateProgress('integrity', 20 + (processedCount / allStories.length) * 80, 
          `Checking story ${processedCount}/${allStories.length}`);
      }

      this.updateProgress('integrity', 100, `${issues.length} integrity issues found`);
      
      return issues;
    } catch (error) {
      console.error('Error checking story integrity:', error);
      this.updateProgress('integrity', 0, 'Error checking integrity');
      throw error;
    }
  }

  /**
   * Gets database statistics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    this.updateProgress('stats', 0, 'Collecting statistics...');
    
    try {
      const [allImages, allVideos, allStories, orphanedImages, orphanedVideos] = await Promise.all([
        this.imageService.getAllImages(),
        this.videoService.getAllVideos(),
        this.storyService.getAllStories(),
        this.findOrphanedImages(),
        this.findOrphanedVideos()
      ]);

      this.updateProgress('stats', 40, 'Counting images in stories...');

      // Count images embedded in story content
      let embeddedImageCount = 0;
      let embeddedImageSize = 0;

      for (const story of allStories) {
        for (const chapter of story.chapters) {
          for (const scene of chapter.scenes) {
            // Find base64 images in HTML content using the same regex as StoryStatsService
            const base64Regex = /<img[^>]*src="data:image\/([^;]+);base64,([^"]+)"/gi;
            let match;
            
            while ((match = base64Regex.exec(scene.content)) !== null) {
              embeddedImageCount++;
              const base64Data = match[2];
              // Calculate size of base64 data (each base64 char is ~0.75 bytes)
              embeddedImageSize += Math.round(base64Data.length * 0.75);
            }
          }
        }
      }

      this.updateProgress('stats', 80, 'Calculating sizes...');

      // Calculate total images: standalone images + embedded images
      const totalImages = allImages.length + embeddedImageCount;
      const standaloneImageSize = allImages.reduce((sum, img) => sum + img.size, 0);
      const totalImageSize = standaloneImageSize + embeddedImageSize;
      const orphanedImageSize = orphanedImages.reduce((sum, img) => sum + img.size, 0);

      // Calculate video statistics
      const totalVideos = allVideos.length;
      const totalVideoSize = allVideos.reduce((sum, vid) => sum + vid.size, 0);
      const orphanedVideoSize = orphanedVideos.reduce((sum, vid) => sum + vid.size, 0);

      // Estimate database size (rough calculation)
      const avgStorySize = 50000; // ~50KB per story estimate
      const databaseSizeEstimate = totalImageSize + totalVideoSize + (allStories.length * avgStorySize);

      const stats: DatabaseStats = {
        totalImages,
        totalVideos,
        totalStories: allStories.length,
        orphanedImages: orphanedImages.length,
        orphanedVideos: orphanedVideos.length,
        totalImageSize,
        totalVideoSize,
        orphanedImageSize,
        orphanedVideoSize,
        databaseSizeEstimate
      };

      this.updateProgress('stats', 100, 'Statistics created');
      
      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      this.updateProgress('stats', 0, 'Error collecting statistics');
      throw error;
    }
  }

  /**
   * Exports complete database as JSON
   */
  async exportDatabase(): Promise<string> {
    this.updateProgress('export', 0, 'Collecting all data...');
    
    try {
      const [allStories, allImages] = await Promise.all([
        this.storyService.getAllStories(),
        this.imageService.getAllImages()
      ]);

      this.updateProgress('export', 70, 'Creating export...');

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        stories: allStories,
        images: allImages
      };

      this.updateProgress('export', 100, 'Export created');
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting database:', error);
      this.updateProgress('export', 0, 'Error creating export');
      throw error;
    }
  }

  /**
   * Formats bytes to human readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clears operation progress
   */
  clearProgress(): void {
    this.operationProgress.next({ operation: '', progress: 0, message: '' });
  }
}