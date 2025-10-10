import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonFooter, IonSpinner, IonImg } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, videocamOutline } from 'ionicons/icons';

@Component({
  selector: 'app-image-viewer-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonSpinner,
    IonImg
  ],
  templateUrl: './image-viewer-modal.component.html',
  styleUrls: ['./image-viewer-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageViewerModalComponent {
  @Input() isOpen = false;
  @Input() imageSrc: string | null = null;
  @Input() imageAlt = '';
  @Input() imageTitle = '';
  @Input() videoSrc: string | null = null;
  @Input() videoName: string | null = null;
  @Input() loadingVideo = false;

  @Output() closed = new EventEmitter<void>();
  @Output() manageVideo = new EventEmitter<void>();

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
    }
  }

  private closingViaControl = false;

  constructor() {
    addIcons({ close, videocamOutline });
  }

  onModalDidDismiss(): void {
    if (this.closingViaControl) {
      this.closingViaControl = false;
      return;
    }
    this.closed.emit();
  }

  onClose(): void {
    if (!this.isOpen) {
      return;
    }

    this.closingViaControl = true;
    this.closed.emit();
  }

  onManageVideo(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closingViaControl = true;
    this.manageVideo.emit();
  }
}
