import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DeviceService } from './device.service';

export interface SyncLog {
  id: string;
  timestamp: Date;
  type: 'upload' | 'download' | 'conflict' | 'error' | 'info';
  action: string;
  details?: string;
  userId?: string;
  itemCount?: number;
  duration?: number;
  status: 'success' | 'error' | 'warning' | 'info';
  deviceId?: string;
  deviceName?: string;
  storyIds?: string[]; // Track which stories were affected
}

@Injectable({
  providedIn: 'root'
})
export class SyncLoggerService {
  private readonly deviceService = inject(DeviceService);
  private readonly STORAGE_KEY = 'creative-writer-sync-logs';
  private readonly MAX_LOGS = 100;

  private logsSubject = new BehaviorSubject<SyncLog[]>([]);
  public logs$: Observable<SyncLog[]> = this.logsSubject.asObservable();

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    try {
      const storedLogs = localStorage.getItem(this.STORAGE_KEY);
      if (storedLogs) {
        const logs = JSON.parse(storedLogs);
        // Convert date strings back to Date objects
        logs.forEach((log: SyncLog & { timestamp: string | Date }) => {
          log.timestamp = new Date(log.timestamp);
        });
        this.logsSubject.next(logs);
      }
    } catch (error) {
      console.error('Error loading sync logs:', error);
    }
  }

  private saveLogs(): void {
    try {
      const logs = this.logsSubject.value;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Error saving sync logs:', error);
    }
  }

  logSync(
    type: SyncLog['type'],
    action: string,
    details?: string,
    options?: {
      userId?: string;
      itemCount?: number;
      duration?: number;
      status?: SyncLog['status'];
      storyIds?: string[];
    }
  ): string {
    const logId = this.generateId();
    const deviceInfo = this.deviceService.getDeviceInfo();

    const log: SyncLog = {
      id: logId,
      timestamp: new Date(),
      type,
      action,
      details,
      userId: options?.userId,
      itemCount: options?.itemCount,
      duration: options?.duration,
      status: options?.status || this.getDefaultStatus(type),
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      storyIds: options?.storyIds
    };

    const currentLogs = this.logsSubject.value;
    const updatedLogs = [log, ...currentLogs].slice(0, this.MAX_LOGS);

    this.logsSubject.next(updatedLogs);
    this.saveLogs();

    return logId;
  }

  updateLog(logId: string, updates: Partial<SyncLog>): void {
    const currentLogs = this.logsSubject.value;
    const index = currentLogs.findIndex(log => log.id === logId);
    
    if (index !== -1) {
      currentLogs[index] = { ...currentLogs[index], ...updates };
      this.logsSubject.next([...currentLogs]);
      this.saveLogs();
    }
  }

  clearLogs(): void {
    this.logsSubject.next([]);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private generateId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultStatus(type: SyncLog['type']): SyncLog['status'] {
    switch (type) {
      case 'error': return 'error';
      case 'conflict': return 'warning';
      case 'info': return 'info';
      default: return 'success';
    }
  }

  // Helper methods for common sync operations
  logUpload(itemCount: number, userId: string, duration?: number): string {
    return this.logSync('upload', `${itemCount} items uploaded`, undefined, {
      userId,
      itemCount,
      duration,
      status: 'success'
    });
  }

  logDownload(itemCount: number, userId: string, duration?: number): string {
    return this.logSync('download', `${itemCount} items downloaded`, undefined, {
      userId,
      itemCount,
      duration,
      status: 'success'
    });
  }

  logConflict(details: string, userId: string): string {
    return this.logSync('conflict', 'Synchronization conflict', details, {
      userId,
      status: 'warning'
    });
  }

  logError(error: string, userId?: string): string {
    return this.logSync('error', 'Synchronization error', error, {
      userId,
      status: 'error'
    });
  }

  logInfo(action: string, details?: string, userId?: string): string {
    return this.logSync('info', action, details, {
      userId,
      status: 'info'
    });
  }
}