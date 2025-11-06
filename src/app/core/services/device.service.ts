import { Injectable } from '@angular/core';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  browser: string;
  platform: string;
  userAgent: string;
  firstSeen: Date;
  lastActive: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly STORAGE_KEY = 'creative-writer-device-info';
  private deviceInfo: DeviceInfo | null = null;

  constructor() {
    this.initializeDevice();
  }

  private initializeDevice(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);

    if (stored) {
      try {
        this.deviceInfo = JSON.parse(stored);
        // Convert date strings back to Date objects
        if (this.deviceInfo) {
          this.deviceInfo.firstSeen = new Date(this.deviceInfo.firstSeen);
          this.deviceInfo.lastActive = new Date(this.deviceInfo.lastActive);
          // Update last active
          this.deviceInfo.lastActive = new Date();
          this.saveDevice();
        }
      } catch (error) {
        console.error('Error loading device info:', error);
        this.createNewDevice();
      }
    } else {
      this.createNewDevice();
    }
  }

  private createNewDevice(): void {
    const deviceId = this.generateDeviceId();
    const browserInfo = this.getBrowserInfo();

    this.deviceInfo = {
      deviceId,
      deviceName: this.generateDefaultDeviceName(browserInfo),
      browser: browserInfo.browser,
      platform: browserInfo.platform,
      userAgent: navigator.userAgent,
      firstSeen: new Date(),
      lastActive: new Date()
    };

    this.saveDevice();
  }

  private generateDeviceId(): string {
    // Create a fingerprint based on browser characteristics
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasFingerprint = '';

    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);
      canvasFingerprint = canvas.toDataURL().slice(-50);
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      canvasFingerprint
    ].join('|');

    // Generate hash
    return this.hashCode(fingerprint);
  }

  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'device-' + Math.abs(hash).toString(36);
  }

  private getBrowserInfo(): { browser: string; platform: string } {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let platform = navigator.platform || 'Unknown';

    // Detect browser
    if (ua.includes('Firefox/')) {
      browser = 'Firefox';
    } else if (ua.includes('Edg/')) {
      browser = 'Edge';
    } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
      browser = 'Chrome';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
      browser = 'Safari';
    } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
      browser = 'Opera';
    }

    // Simplify platform
    if (platform.includes('Win')) {
      platform = 'Windows';
    } else if (platform.includes('Mac')) {
      platform = 'macOS';
    } else if (platform.includes('Linux')) {
      platform = 'Linux';
    } else if (platform.includes('Android')) {
      platform = 'Android';
    } else if (platform.includes('iOS') || platform.includes('iPhone') || platform.includes('iPad')) {
      platform = 'iOS';
    }

    return { browser, platform };
  }

  private generateDefaultDeviceName(info: { browser: string; platform: string }): string {
    return `${info.browser} on ${info.platform}`;
  }

  private saveDevice(): void {
    if (this.deviceInfo) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.deviceInfo));
    }
  }

  getDeviceInfo(): DeviceInfo {
    if (!this.deviceInfo) {
      this.initializeDevice();
    }
    return this.deviceInfo!;
  }

  getDeviceId(): string {
    return this.getDeviceInfo().deviceId;
  }

  getDeviceName(): string {
    return this.getDeviceInfo().deviceName;
  }

  updateDeviceName(name: string): void {
    if (this.deviceInfo) {
      this.deviceInfo.deviceName = name;
      this.saveDevice();
    }
  }

  updateLastActive(): void {
    if (this.deviceInfo) {
      this.deviceInfo.lastActive = new Date();
      this.saveDevice();
    }
  }
}
