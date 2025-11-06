import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonList, IonItem, IonLabel, IonChip, IonIcon, IonButton,
  IonSegment, IonSegmentButton, IonSelect, IonSelectOption,
  IonSpinner, IonBadge, IonNote, IonSearchbar,
  ActionSheetController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBack, cloudUpload, cloudDownload, warning, alertCircle, informationCircle,
  checkmarkCircle, close, funnel, trash, refresh, laptop, desktop
} from 'ionicons/icons';
import { SyncLoggerService, SyncLog } from '../../../core/services/sync-logger.service';
import { DeviceService } from '../../../core/services/device.service';
import { StoryService } from '../../services/story.service';
import { Story } from '../../models/story.interface';
import { AppHeaderComponent, HeaderAction } from '../../../ui/components/app-header.component';

type ViewMode = 'logs' | 'stories';
type FilterType = 'all' | 'upload' | 'download' | 'conflict' | 'error' | 'info';

interface StoryModification {
  storyId: string;
  storyTitle: string;
  lastModifiedBy?: {
    deviceId: string;
    deviceName: string;
    timestamp: Date;
  };
  modifications: SyncLog[];
}

@Component({
  selector: 'app-sync-history',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonList, IonItem, IonLabel, IonChip, IonIcon, IonButton,
    IonSegment, IonSegmentButton, IonSelect, IonSelectOption,
    IonSpinner, IonBadge, IonNote, IonSearchbar,
    AppHeaderComponent
  ],
  templateUrl: './sync-history.component.html',
  styleUrls: ['./sync-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyncHistoryComponent implements OnInit, OnDestroy {
  private syncLogger = inject(SyncLoggerService);
  private deviceService = inject(DeviceService);
  private storyService = inject(StoryService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private actionSheetCtrl = inject(ActionSheetController);
  private toastCtrl = inject(ToastController);
  private destroy$ = new Subject<void>();

  viewMode: ViewMode = 'logs';
  filterType: FilterType = 'all';
  searchText = '';

  allLogs: SyncLog[] = [];
  filteredLogs: SyncLog[] = [];
  stories: Story[] = [];
  storyModifications: StoryModification[] = [];
  currentDeviceId = '';
  loading = true;

  leftActions: HeaderAction[] = [
    {
      icon: 'arrow-back',
      label: 'Back to story list',
      action: () => this.goBack()
    }
  ];

  constructor() {
    addIcons({
      arrowBack, cloudUpload, cloudDownload, warning, alertCircle, informationCircle,
      checkmarkCircle, close, funnel, trash, refresh, laptop, desktop
    });
  }

  async ngOnInit(): Promise<void> {
    this.currentDeviceId = this.deviceService.getDeviceId();

    // Subscribe to sync logs
    this.syncLogger.logs$
      .pipe(takeUntil(this.destroy$))
      .subscribe(logs => {
        this.allLogs = logs;
        this.applyFilters();
        this.cdr.markForCheck();
      });

    // Load stories
    await this.loadStories();
    this.loading = false;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadStories(): Promise<void> {
    try {
      this.stories = await this.storyService.getAllStories();
      this.buildStoryModifications();
    } catch (error) {
      console.error('Error loading stories:', error);
      await this.showToast('Error loading stories', 'danger');
    }
  }

  buildStoryModifications(): void {
    const storyMap = new Map<string, StoryModification>();

    // First, add all stories with their device modification info
    this.stories.forEach(story => {
      storyMap.set(story.id, {
        storyId: story.id,
        storyTitle: story.title || 'Untitled Story',
        lastModifiedBy: story.lastModifiedBy,
        modifications: []
      });
    });

    // Then, add sync logs that reference stories
    this.allLogs.forEach(log => {
      if (log.storyIds && log.storyIds.length > 0) {
        log.storyIds.forEach(storyId => {
          const modification = storyMap.get(storyId);
          if (modification) {
            modification.modifications.push(log);
          }
        });
      }
    });

    this.storyModifications = Array.from(storyMap.values())
      .filter(mod => mod.lastModifiedBy || mod.modifications.length > 0)
      .sort((a, b) => {
        const aTime = a.lastModifiedBy?.timestamp?.getTime() || 0;
        const bTime = b.lastModifiedBy?.timestamp?.getTime() || 0;
        return bTime - aTime;
      });
  }

  applyFilters(): void {
    let filtered = [...this.allLogs];

    // Apply type filter
    if (this.filterType !== 'all') {
      filtered = filtered.filter(log => log.type === this.filterType);
    }

    // Apply search filter
    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(search) ||
        log.details?.toLowerCase().includes(search) ||
        log.deviceName?.toLowerCase().includes(search)
      );
    }

    this.filteredLogs = filtered;
  }

  onViewModeChange(event: CustomEvent): void {
    this.viewMode = event.detail.value as ViewMode;
    this.cdr.markForCheck();
  }

  onFilterChange(event: CustomEvent): void {
    this.filterType = event.detail.value as FilterType;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSearchChange(event: CustomEvent): void {
    this.searchText = event.detail.value || '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  async clearLogs(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Clear All Sync Logs?',
      subHeader: 'This will remove all sync history. Story device information will be preserved.',
      buttons: [
        {
          text: 'Clear All Logs',
          role: 'destructive',
          icon: 'trash',
          handler: () => {
            this.syncLogger.clearLogs();
            this.showToast('Sync logs cleared', 'success');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });

    await actionSheet.present();
  }

  async refreshData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    await this.loadStories();

    this.loading = false;
    this.cdr.markForCheck();
    await this.showToast('Data refreshed', 'success');
  }

  goBack(): void {
    this.router.navigate(['/stories']);
  }

  getTypeIcon(type: SyncLog['type']): string {
    switch (type) {
      case 'upload': return 'cloud-upload';
      case 'download': return 'cloud-download';
      case 'conflict': return 'warning';
      case 'error': return 'alert-circle';
      case 'info': return 'information-circle';
      default: return 'information-circle';
    }
  }

  getTypeColor(type: SyncLog['type']): string {
    switch (type) {
      case 'upload': return 'primary';
      case 'download': return 'secondary';
      case 'conflict': return 'warning';
      case 'error': return 'danger';
      case 'info': return 'medium';
      default: return 'medium';
    }
  }

  getStatusColor(status: SyncLog['status']): string {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'medium';
      default: return 'medium';
    }
  }

  isCurrentDevice(deviceId?: string): boolean {
    return deviceId === this.currentDeviceId;
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return new Date(date).toLocaleDateString();
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  formatDateTime(date: Date): string {
    if (!date) return '';
    return new Date(date).toLocaleString();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'medium'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  trackByLogId(index: number, log: SyncLog): string {
    return log.id;
  }

  trackByStoryId(index: number, mod: StoryModification): string {
    return mod.storyId;
  }
}
