import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';

export interface BackupData {
  metadata: {
    appName: string;
    version: string;
    exportDate: string;
    totalDocs: number;
    source?: 'local' | 'remote';
  };
  documents: unknown[];
}

export interface ExportProgress {
  current: number;
  total: number;
  currentDocId?: string;
  phase: 'fetching-ids' | 'fetching-docs' | 'complete';
}

export interface ImportProgress {
  phase: 'clearing-remote' | 'clearing-local' | 'importing' | 'syncing' | 'complete';
  message?: string;
  current?: number;
  total?: number;
}

export type ExportProgressCallback = (progress: ExportProgress) => void;
export type ImportProgressCallback = (progress: ImportProgress) => void;

@Injectable({
  providedIn: 'root'
})
export class DatabaseBackupService {
  private readonly databaseService = inject(DatabaseService);

  async exportDatabase(): Promise<string> {
    const db = await this.databaseService.getDatabase();
    
    // First, get all document IDs
    const allDocsResult = await db.allDocs();
    const docIds = allDocsResult.rows
      .filter(row => !row.id.startsWith('_design/'))
      .map(row => row.id);
    
    // Then fetch each document individually with attachments
    const documents = [];
    
    for (const docId of docIds) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = await (db.get as any)(docId, { 
          attachments: true, 
          binary: false // Get as base64
        });
        documents.push(doc);
      } catch (error) {
        console.warn(`Failed to export document ${docId}:`, error);
        // Try to get without attachments as fallback
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docWithoutAttachments = await db.get(docId) as any;
          // Remove attachment references to avoid stub issues
          if (docWithoutAttachments['_attachments']) {
            delete docWithoutAttachments['_attachments'];
          }
          documents.push(docWithoutAttachments);
        } catch (fallbackError) {
          console.error(`Failed to export document ${docId} even without attachments:`, fallbackError);
        }
      }
    }
    
    const backupData: BackupData = {
      metadata: {
        appName: 'Creative Writer 2',
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        totalDocs: documents.length
      },
      documents: documents
    };
    
    return JSON.stringify(backupData, null, 2);
  }

  async importDatabase(jsonData: string, progressCallback?: ImportProgressCallback): Promise<void> {
    const db = await this.databaseService.getDatabase();

    let backupData: BackupData;
    try {
      backupData = JSON.parse(jsonData);
    } catch {
      throw new Error('Invalid backup file format. Please ensure the file is a valid JSON backup.');
    }

    // Validate backup data structure
    if (!backupData.metadata || !Array.isArray(backupData.documents)) {
      throw new Error('Invalid backup file structure. The file does not contain the expected backup format.');
    }

    if (backupData.documents.length === 0) {
      throw new Error('Backup file contains no documents to import.');
    }

    // Check remote connection - required for full restore
    const remoteDb = this.databaseService.getRemoteDatabase();
    if (!remoteDb) {
      throw new Error('Remote database not connected. Please enable sync in Settings before importing to ensure complete restoration.');
    }

    // Step 1: Clear remote database first
    progressCallback?.({ phase: 'clearing-remote', message: 'Clearing remote database...' });
    console.log('Clearing remote database...');
    const remoteDocsCleared = await this.clearRemoteDatabase();
    console.log(`Cleared ${remoteDocsCleared} documents from remote database`);

    // Step 2: Clear the local database completely
    progressCallback?.({ phase: 'clearing-local', message: 'Clearing local database...' });
    console.log('Clearing local database...');
    const existingDocs = await db.allDocs();
    const docsToDelete = existingDocs.rows
      .filter(row => !row.id.startsWith('_design/')) // Keep design documents
      .map(row => ({
        _id: row.id,
        _rev: row.value.rev,
        _deleted: true
      }));

    if (docsToDelete.length > 0) {
      await db.bulkDocs(docsToDelete);
    }
    console.log(`Cleared ${docsToDelete.length} documents from local database`);

    // Step 3: Import all documents from backup
    console.log(`Importing ${backupData.documents.length} documents...`);
    progressCallback?.({ phase: 'importing', current: 0, total: backupData.documents.length, message: 'Importing documents...' });

    // Import documents in batches for better performance
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < backupData.documents.length; i += batchSize) {
      batches.push(backupData.documents.slice(i, i + batchSize));
    }

    let importedCount = 0;

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} documents`);

      try {
        // Clean documents for import (remove _rev to avoid conflicts and handle attachments)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanDocs = batch.map((doc: any) => {
          const cleanDoc = { ...doc };
          delete cleanDoc['_rev']; // Remove revision for fresh import

          // Handle attachment stubs - if attachments exist but don't have data, remove them
          if (cleanDoc['_attachments']) {
            const attachments = cleanDoc['_attachments'];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasValidAttachments = Object.values(attachments).some((att: any) =>
              att.data || (att.content_type && att.length)
            );

            if (!hasValidAttachments) {
              console.warn(`Removing invalid attachment stubs from document ${cleanDoc['_id']}`);
              delete cleanDoc['_attachments'];
            }
          }

          return cleanDoc;
        });

        try {
          await db.bulkDocs(cleanDocs);
          console.log(`Batch ${i + 1} imported successfully`);
          importedCount += cleanDocs.length;
        } catch (error) {
          console.warn(`Batch ${i + 1} bulk import failed, trying individual documents:`, error);
          // If bulk import fails, try importing each document individually
          for (let j = 0; j < cleanDocs.length; j++) {
            const doc = cleanDocs[j];
            try {
              await db.put(doc);
              importedCount++;
            } catch (docError) {
              console.warn(`Failed to import document ${doc['_id']} (${j + 1}/${cleanDocs.length}):`, docError);

              // If it's an attachment error, try without attachments
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const error = docError as any;
              if (error.name === 'missing_stub' || error.message?.includes('stub') || error.message?.includes('attachment')) {
                try {
                  const docWithoutAttachments = { ...doc };
                  delete docWithoutAttachments['_attachments'];
                  await db.put(docWithoutAttachments);
                  importedCount++;
                  console.warn(`Successfully imported document ${doc['_id']} without attachments`);
                } catch (finalError) {
                  console.error(`Failed to import document ${doc['_id']} even without attachments:`, finalError);
                }
              }
            }
          }
        }

        // Report import progress
        progressCallback?.({ phase: 'importing', current: importedCount, total: backupData.documents.length, message: `Imported ${importedCount} of ${backupData.documents.length} documents...` });
      } catch (batchError) {
        console.error(`Critical error processing batch ${i + 1}:`, batchError);
        // Continue with next batch even if this one fails completely
      }
    }

    // Step 4: Force push to remote to sync imported data
    progressCallback?.({ phase: 'syncing', message: 'Syncing to remote database...' });
    console.log('Force pushing imported data to remote...');
    try {
      const pushResult = await this.databaseService.forcePush();
      console.log(`Pushed ${pushResult.docsProcessed} documents to remote`);
    } catch (pushError) {
      console.error('Failed to push to remote:', pushError);
      // Don't fail the import, but warn the user
      console.warn('Import completed locally but sync to remote may be incomplete. Data will sync automatically.');
    }

    progressCallback?.({ phase: 'complete', message: 'Import completed successfully!' });
    console.log('Database import completed successfully');
  }

  async getDatabaseInfo(): Promise<{ totalDocs: number; dbName: string; lastUpdated?: Date }> {
    const db = await this.databaseService.getDatabase();
    const info = await db.info();
    
    return {
      totalDocs: info.doc_count,
      dbName: info.db_name,
      lastUpdated: info.update_seq ? new Date() : undefined
    };
  }

  downloadFile(content: string, filename: string, mimeType = 'application/json'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  generateFilename(): string {
    const date = new Date();
    const timestamp = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `creative-writer-backup-${timestamp}.json`;
  }

  /**
   * Check if remote database is available
   */
  isRemoteAvailable(): boolean {
    return this.databaseService.getRemoteDatabase() !== null;
  }

  /**
   * Get information about the remote database
   */
  async getRemoteDatabaseInfo(): Promise<{ totalDocs: number; dbName: string } | null> {
    const remoteDb = this.databaseService.getRemoteDatabase();
    if (!remoteDb) {
      return null;
    }

    try {
      const info = await remoteDb.info();
      return {
        totalDocs: info.doc_count,
        dbName: info.db_name
      };
    } catch (error) {
      console.error('Failed to get remote database info:', error);
      return null;
    }
  }

  /**
   * Export database directly from remote CouchDB
   */
  async exportFromRemote(progressCallback?: ExportProgressCallback): Promise<string> {
    const remoteDb = this.databaseService.getRemoteDatabase();
    if (!remoteDb) {
      throw new Error('Remote database not connected. Please ensure sync is enabled in Settings.');
    }

    // Report initial phase
    progressCallback?.({ current: 0, total: 0, phase: 'fetching-ids' });

    // First, get all document IDs from remote
    const allDocsResult = await remoteDb.allDocs();
    const docIds = allDocsResult.rows
      .filter(row => !row.id.startsWith('_design/'))
      .map(row => row.id);

    const total = docIds.length;
    const documents = [];

    // Report fetching phase
    progressCallback?.({ current: 0, total, phase: 'fetching-docs' });

    // Fetch each document with attachments
    for (let i = 0; i < docIds.length; i++) {
      const docId = docIds[i];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = await (remoteDb.get as any)(docId, {
          attachments: true,
          binary: false // Get as base64
        });
        documents.push(doc);
      } catch (error) {
        console.warn(`Failed to export document ${docId} from remote:`, error);
        // Try to get without attachments as fallback
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docWithoutAttachments = await remoteDb.get(docId) as any;
          if (docWithoutAttachments['_attachments']) {
            delete docWithoutAttachments['_attachments'];
          }
          documents.push(docWithoutAttachments);
        } catch (fallbackError) {
          console.error(`Failed to export document ${docId} even without attachments:`, fallbackError);
        }
      }

      // Report progress
      progressCallback?.({
        current: i + 1,
        total,
        currentDocId: docId,
        phase: 'fetching-docs'
      });
    }

    // Report complete
    progressCallback?.({ current: total, total, phase: 'complete' });

    const backupData: BackupData = {
      metadata: {
        appName: 'Creative Writer 2',
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        totalDocs: documents.length,
        source: 'remote'
      },
      documents: documents
    };

    return JSON.stringify(backupData, null, 2);
  }

  /**
   * Clear all documents from remote database
   */
  private async clearRemoteDatabase(): Promise<number> {
    const remoteDb = this.databaseService.getRemoteDatabase();
    if (!remoteDb) {
      throw new Error('Remote database not connected');
    }

    const allDocsResult = await remoteDb.allDocs();
    const docsToDelete = allDocsResult.rows
      .filter(row => !row.id.startsWith('_design/'))
      .map(row => ({
        _id: row.id,
        _rev: row.value.rev,
        _deleted: true
      }));

    if (docsToDelete.length > 0) {
      await remoteDb.bulkDocs(docsToDelete);
    }

    return docsToDelete.length;
  }
}