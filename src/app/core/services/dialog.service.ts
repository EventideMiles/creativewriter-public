import { inject, Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';

/**
 * Options for standard confirmation dialogs
 */
export interface ConfirmOptions {
  header: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

/**
 * Options for destructive confirmation dialogs
 */
export interface DestructiveConfirmOptions {
  header: string;
  message: string;
  confirmText?: string;
}

/**
 * Options for alert dialogs (info, error, success)
 */
export interface AlertOptions {
  header: string;
  message: string;
  buttonText?: string;
}

/**
 * DialogService provides a unified API for all confirmation and alert dialogs
 * throughout the application. This replaces browser's native confirm() with
 * styled Ionic alerts that match the app's design system.
 *
 * Usage:
 * ```typescript
 * // Simple confirmation
 * const confirmed = await this.dialogService.confirm({
 *   header: 'Delete Story',
 *   message: 'Are you sure you want to delete this story?'
 * });
 *
 * // Destructive confirmation (red button)
 * const confirmed = await this.dialogService.confirmDestructive({
 *   header: 'Delete Story',
 *   message: 'This action cannot be undone.',
 *   confirmText: 'Delete Forever'
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private alertController = inject(AlertController);

  /**
   * Shows a standard confirmation dialog with Cancel and Confirm buttons.
   * Returns true if confirmed, false if cancelled.
   */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'cw-confirm-dialog',
      buttons: [
        {
          text: options.cancelText || 'Cancel',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: options.confirmText || 'Confirm',
          role: 'confirm',
          cssClass: 'alert-button-confirm'
        }
      ]
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  /**
   * Shows a destructive confirmation dialog with Cancel and a red Delete/Confirm button.
   * Use this for irreversible actions like deletion.
   * Returns true if confirmed, false if cancelled.
   */
  async confirmDestructive(options: DestructiveConfirmOptions): Promise<boolean> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'cw-destructive-dialog',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: options.confirmText || 'Delete',
          role: 'confirm',
          cssClass: 'alert-button-danger'
        }
      ]
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  /**
   * Shows an informational alert with a single OK button.
   */
  async showInfo(options: AlertOptions): Promise<void> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'cw-info-dialog',
      buttons: [
        {
          text: options.buttonText || 'OK',
          role: 'confirm'
        }
      ]
    });

    await alert.present();
    await alert.onDidDismiss();
  }

  /**
   * Shows an error alert with a single OK button.
   */
  async showError(options: AlertOptions): Promise<void> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'cw-error-dialog',
      buttons: [
        {
          text: options.buttonText || 'OK',
          role: 'confirm',
          cssClass: 'alert-button-danger'
        }
      ]
    });

    await alert.present();
    await alert.onDidDismiss();
  }

  /**
   * Shows a success alert with a single OK button.
   */
  async showSuccess(options: AlertOptions): Promise<void> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'cw-success-dialog',
      buttons: [
        {
          text: options.buttonText || 'OK',
          role: 'confirm',
          cssClass: 'alert-button-success'
        }
      ]
    });

    await alert.present();
    await alert.onDidDismiss();
  }

  /**
   * Shows a warning confirmation dialog.
   * Similar to confirm() but with warning styling.
   */
  async confirmWarning(options: ConfirmOptions): Promise<boolean> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'cw-warning-dialog',
      buttons: [
        {
          text: options.cancelText || 'Cancel',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: options.confirmText || 'Continue',
          role: 'confirm',
          cssClass: 'alert-button-warning'
        }
      ]
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }
}
