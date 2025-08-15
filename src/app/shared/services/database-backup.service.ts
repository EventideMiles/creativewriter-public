import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';

export interface BackupData {
  metadata: {
    appName: string;
    version: string;
    exportDate: string;
    totalDocs: number;
  };
  documents: unknown[];
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseBackupService {
  private readonly databaseService = inject(DatabaseService);

  async exportDatabase(): Promise<string> {
    const db = await this.databaseService.getDatabase();
    
    // Get all documents from the database, including attachments
    const result = await db.allDocs({ 
      include_docs: true,
      attachments: true,
      binary: false // Get attachments as base64 strings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any); // Cast to bypass TypeScript restrictions for attachments option
    
    // Filter out design documents and internal documents
    const documents = result.rows
      .filter(row => !row.id.startsWith('_design/'))
      .map(row => row.doc);
    
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

  async importDatabase(jsonData: string): Promise<void> {
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
    
    // Step 1: Clear the current database completely
    console.log('Clearing current database...');
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
    
    // Step 2: Import all documents from backup
    console.log(`Importing ${backupData.documents.length} documents...`);
    
    // Import documents in batches for better performance
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < backupData.documents.length; i += batchSize) {
      batches.push(backupData.documents.slice(i, i + batchSize));
    }
    
    // Process each batch
    for (const batch of batches) {
      // Clean documents for import (remove _rev to avoid conflicts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cleanDocs = batch.map((doc: any) => {
        const cleanDoc = { ...doc };
        delete cleanDoc['_rev']; // Remove revision for fresh import
        return cleanDoc;
      });
      
      try {
        await db.bulkDocs(cleanDocs);
      } catch (error) {
        console.warn('Bulk import failed, trying individual documents:', error);
        // If bulk import fails, try importing each document individually
        for (const doc of cleanDocs) {
          try {
            await db.put(doc);
          } catch (docError) {
            console.warn(`Failed to import document ${doc['_id']}:`, docError);
            // Continue with next document even if one fails
          }
        }
      }
    }
    
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
}