import { Injectable } from '@angular/core';

export interface PerformanceMetrics {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usedPercentage: number;
  };
  timing: {
    navigationStart: number;
    loadEventEnd: number;
    domContentLoadedEventEnd: number;
  };
  userAgent: string;
  platform: string;
  viewport: {
    width: number;
    height: number;
  };
  orientation: string;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

export interface CrashLog {
  timestamp: string;
  error: string;
  stack?: string;
  url: string;
  userAgent: string;
  metrics: PerformanceMetrics;
  localStorage: {
    itemCount: number;
    estimatedSize: number;
  };
  indexedDB: {
    databases?: string[];
  };
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsedMB: number | null;
  realMemoryMB: number | null; // From measureUserAgentSpecificMemory (if available)
  domNodes: number;
  eventListeners: number;
  storageUsedMB: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class MobileDebugService {
  private readonly CRASH_LOG_KEY = 'mobile_crash_logs';
  private readonly MAX_CRASH_LOGS = 50;
  private memoryWarningThreshold = 0.9; // 90% memory usage
  private memoryCheckInterval: number | null = null;

  // Memory overlay for debugging
  private overlayElement: HTMLElement | null = null;
  private overlayUpdateInterval: number | null = null;
  private memoryHistory: MemorySnapshot[] = [];
  private readonly MAX_HISTORY_LENGTH = 60; // Keep 60 snapshots (5 minutes at 5s intervals)
  private initialSnapshot: MemorySnapshot | null = null;

  // Debug sync pause flag
  private readonly DEBUG_SYNC_PAUSE_KEY = 'debug_sync_paused';

  // Event handler references for proper cleanup
  private handleError = (event: ErrorEvent) => {
    console.error('[MobileDebug] Unhandled error:', event.error);
    this.logCrash(event.error || event.message);
  };
  private handleRejection = (event: PromiseRejectionEvent) => {
    console.error('[MobileDebug] Unhandled rejection:', event.reason);
    this.logCrash(event.reason);
  };

  constructor() {
    this.setupGlobalErrorHandlers();
    this.startMemoryMonitoring();
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const performance = window.performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    const metrics: PerformanceMetrics = {
      timing: {
        navigationStart: performance.timing.navigationStart,
        loadEventEnd: performance.timing.loadEventEnd,
        domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
      },
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      orientation: screen.orientation?.type || 'unknown'
    };

    // Memory info (Chrome/Edge only)
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      const limit = performance.memory.jsHeapSizeLimit;
      metrics.memory = {
        usedJSHeapSize: used,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: limit,
        usedPercentage: (used / limit) * 100
      };
    }

    // Network info
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }).connection;

    if (connection) {
      metrics.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }

    return metrics;
  }

  /**
   * Log a crash with detailed context
   */
  logCrash(error: Error | string): void {
    const crashLog: CrashLog = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: this.getPerformanceMetrics(),
      localStorage: this.getLocalStorageInfo(),
      indexedDB: {
        databases: [] // Will be populated if available
      }
    };

    // Try to get IndexedDB info
    this.getIndexedDBInfo().then(dbInfo => {
      crashLog.indexedDB = dbInfo;
      this.saveCrashLog(crashLog);
    }).catch(() => {
      this.saveCrashLog(crashLog);
    });
  }

  /**
   * Get all stored crash logs
   */
  getCrashLogs(): CrashLog[] {
    try {
      const logs = localStorage.getItem(this.CRASH_LOG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all crash logs
   */
  clearCrashLogs(): void {
    localStorage.removeItem(this.CRASH_LOG_KEY);
  }

  /**
   * Export crash logs as JSON string for debugging
   */
  exportCrashLogs(): string {
    const logs = this.getCrashLogs();
    const metrics = this.getPerformanceMetrics();
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      currentMetrics: metrics,
      crashLogs: logs
    }, null, 2);
  }

  /**
   * Check if memory usage is high
   */
  isMemoryHigh(): boolean {
    const metrics = this.getPerformanceMetrics();
    return metrics.memory ? metrics.memory.usedPercentage > this.memoryWarningThreshold * 100 : false;
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsagePercentage(): number | null {
    const metrics = this.getPerformanceMetrics();
    return metrics.memory ? metrics.memory.usedPercentage : null;
  }

  private setupGlobalErrorHandlers(): void {
    // Catch unhandled errors - use stored references for cleanup
    window.addEventListener('error', this.handleError);

    // Catch unhandled promise rejections - use stored references for cleanup
    window.addEventListener('unhandledrejection', this.handleRejection);
  }

  private startMemoryMonitoring(): void {
    // Check memory every 30 seconds
    this.memoryCheckInterval = window.setInterval(() => {
      if (this.isMemoryHigh()) {
        console.warn('[MobileDebug] High memory usage detected!', this.getMemoryUsagePercentage());
        // You could trigger cleanup here or show a warning to the user
      }
    }, 30000);
  }

  private saveCrashLog(log: CrashLog): void {
    try {
      const logs = this.getCrashLogs();
      logs.unshift(log); // Add to beginning

      // Keep only the most recent logs
      if (logs.length > this.MAX_CRASH_LOGS) {
        logs.splice(this.MAX_CRASH_LOGS);
      }

      localStorage.setItem(this.CRASH_LOG_KEY, JSON.stringify(logs));
      console.log('[MobileDebug] Crash log saved:', log);
    } catch (error) {
      console.error('[MobileDebug] Failed to save crash log:', error);
    }
  }

  private getLocalStorageInfo(): { itemCount: number; estimatedSize: number } {
    let itemCount = 0;
    let estimatedSize = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          itemCount++;
          const value = localStorage.getItem(key);
          if (value) {
            estimatedSize += key.length + value.length;
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return { itemCount, estimatedSize };
  }

  private async getIndexedDBInfo(): Promise<{ databases?: string[] }> {
    if (!('indexedDB' in window)) {
      return {};
    }

    try {
      // Modern browsers support databases() method
      if ('databases' in indexedDB) {
        const dbs = await (indexedDB as IDBFactory & {
          databases: () => Promise<{ name?: string; version?: number }[]>;
        }).databases();
        return {
          databases: dbs.map(db => `${db.name} (v${db.version})`)
        };
      }
    } catch {
      // Fall back to known database names
      return {
        databases: ['Unable to enumerate - check manually']
      };
    }

    return {};
  }

  /**
   * Stop memory monitoring and remove event handlers (cleanup)
   */
  destroy(): void {
    if (this.memoryCheckInterval !== null) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    // Remove global error handlers
    window.removeEventListener('error', this.handleError);
    window.removeEventListener('unhandledrejection', this.handleRejection);

    // Clean up overlay
    this.hideMemoryOverlay();
  }

  // ===== Memory Debug Overlay =====

  /**
   * Take a snapshot of current memory/DOM metrics
   */
  private takeMemorySnapshot(): MemorySnapshot {
    const performance = window.performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    // Count DOM nodes
    const domNodes = document.getElementsByTagName('*').length;

    // Estimate event listeners by checking common patterns
    // Note: This is an approximation as there's no direct API
    let eventListeners = 0;
    try {
      // Count elements with onclick, onscroll, etc. attributes
      const elementsWithHandlers = document.querySelectorAll('[onclick], [onscroll], [onmousemove], [ontouchstart], [ontouchmove]');
      eventListeners = elementsWithHandlers.length;
    } catch {
      eventListeners = -1;
    }

    return {
      timestamp: Date.now(),
      heapUsedMB: performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10
        : null,
      realMemoryMB: this.lastRealMemoryMB, // Updated async
      domNodes,
      eventListeners,
      storageUsedMB: this.lastStorageUsedMB // Updated async
    };
  }

  // Cached values for async metrics
  private lastRealMemoryMB: number | null = null;
  private lastStorageUsedMB: number | null = null;

  /**
   * Update async metrics (storage, real memory)
   */
  private async updateAsyncMetrics(): Promise<void> {
    // Update storage estimate
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          this.lastStorageUsedMB = Math.round(estimate.usage / 1024 / 1024 * 10) / 10;
        }
      }
    } catch {
      // Ignore storage estimate errors
    }

    // Try measureUserAgentSpecificMemory (Chrome 89+ with crossOriginIsolated)
    try {
      const perf = performance as Performance & {
        measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
      };
      if (perf.measureUserAgentSpecificMemory && crossOriginIsolated) {
        const result = await perf.measureUserAgentSpecificMemory();
        if (result.bytes) {
          this.lastRealMemoryMB = Math.round(result.bytes / 1024 / 1024 * 10) / 10;
        }
      }
    } catch {
      // Not available or not cross-origin isolated
    }
  }

  /**
   * Show floating memory overlay for debugging on mobile
   * Updates every 5 seconds with memory metrics and growth rate
   */
  showMemoryOverlay(): void {
    if (this.overlayElement) {
      return; // Already showing
    }

    // Fetch async metrics first, then take initial snapshot
    this.updateAsyncMetrics().then(() => {
      this.initialSnapshot = this.takeMemorySnapshot();
      this.memoryHistory = [this.initialSnapshot!];
    });

    // Take initial snapshot (sync values only for now)
    this.initialSnapshot = this.takeMemorySnapshot();
    this.memoryHistory = [this.initialSnapshot];

    // Create overlay element
    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'memory-debug-overlay';
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 60px;
      right: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: #00ff00;
      font-family: monospace;
      font-size: 11px;
      padding: 8px 10px;
      border-radius: 6px;
      z-index: 999999;
      max-width: 180px;
      pointer-events: auto;
      user-select: none;
      border: 1px solid #00ff00;
    `;

    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.textContent = ' ✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 2px;
      right: 6px;
      cursor: pointer;
      font-size: 14px;
      color: #ff6666;
    `;
    closeBtn.onclick = () => this.hideMemoryOverlay();

    this.overlayElement.appendChild(closeBtn);
    document.body.appendChild(this.overlayElement);

    // Update immediately and then every 5 seconds
    this.updateOverlay();
    this.overlayUpdateInterval = window.setInterval(() => {
      this.updateOverlay();
    }, 5000);
  }

  /**
   * Hide the memory overlay
   */
  hideMemoryOverlay(): void {
    if (this.overlayUpdateInterval !== null) {
      clearInterval(this.overlayUpdateInterval);
      this.overlayUpdateInterval = null;
    }

    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }

    this.memoryHistory = [];
    this.initialSnapshot = null;
  }

  /**
   * Toggle memory overlay visibility
   */
  toggleMemoryOverlay(): void {
    if (this.overlayElement) {
      this.hideMemoryOverlay();
    } else {
      this.showMemoryOverlay();
    }
  }

  /**
   * Check if overlay is currently visible
   */
  isOverlayVisible(): boolean {
    return this.overlayElement !== null;
  }

  /**
   * Update the overlay with current metrics
   */
  private async updateOverlay(): Promise<void> {
    if (!this.overlayElement || !this.initialSnapshot) {
      return;
    }

    // Update async metrics (storage, real memory)
    await this.updateAsyncMetrics();

    const snapshot = this.takeMemorySnapshot();

    // Add to history
    this.memoryHistory.push(snapshot);
    if (this.memoryHistory.length > this.MAX_HISTORY_LENGTH) {
      this.memoryHistory.shift();
    }

    // Calculate growth since start
    const elapsedSeconds = Math.round((snapshot.timestamp - this.initialSnapshot.timestamp) / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const remainingSeconds = elapsedSeconds % 60;
    const timeStr = elapsedMinutes > 0
      ? `${elapsedMinutes}m ${remainingSeconds}s`
      : `${elapsedSeconds}s`;

    const domGrowth = snapshot.domNodes - this.initialSnapshot.domNodes;
    const domGrowthStr = domGrowth >= 0 ? `+${domGrowth}` : `${domGrowth}`;
    const domColor = domGrowth > 100 ? '#ff6666' : domGrowth > 50 ? '#ffff00' : '#00ff00';

    // JS Heap (Chrome only - shows JS allocations, not full memory)
    let heapInfo = 'N/A';
    let heapColor = '#888888';
    if (snapshot.heapUsedMB !== null && this.initialSnapshot.heapUsedMB !== null) {
      const heapGrowth = Math.round((snapshot.heapUsedMB - this.initialSnapshot.heapUsedMB) * 10) / 10;
      const heapGrowthStr = heapGrowth >= 0 ? `+${heapGrowth}` : `${heapGrowth}`;
      heapColor = heapGrowth > 50 ? '#ff6666' : heapGrowth > 20 ? '#ffff00' : '#00ff00';
      heapInfo = `${snapshot.heapUsedMB}MB (<span style="color:${heapColor}">${heapGrowthStr}</span>)`;
    }

    // Storage (IndexedDB + Cache - works on all browsers)
    let storageInfo = 'N/A';
    let storageColor = '#888888';
    if (snapshot.storageUsedMB !== null) {
      const initialStorage = this.initialSnapshot.storageUsedMB ?? snapshot.storageUsedMB;
      const storageGrowth = Math.round((snapshot.storageUsedMB - initialStorage) * 10) / 10;
      const storageGrowthStr = storageGrowth >= 0 ? `+${storageGrowth}` : `${storageGrowth}`;
      storageColor = storageGrowth > 10 ? '#ff6666' : storageGrowth > 5 ? '#ffff00' : '#00ff00';
      storageInfo = `${snapshot.storageUsedMB}MB (<span style="color:${storageColor}">${storageGrowthStr}</span>)`;
    }

    // Calculate heap growth rate (last 30 seconds)
    let growthRate = '';
    if (this.memoryHistory.length >= 6) { // 6 snapshots = 30 seconds
      const oldSnapshot = this.memoryHistory[this.memoryHistory.length - 6];
      const domRate = snapshot.domNodes - oldSnapshot.domNodes;
      const heapRate = (snapshot.heapUsedMB !== null && oldSnapshot.heapUsedMB !== null)
        ? Math.round((snapshot.heapUsedMB - oldSnapshot.heapUsedMB) * 10) / 10
        : null;

      const rates: string[] = [];
      if (domRate !== 0) {
        rates.push(`DOM ${domRate > 0 ? '+' : ''}${domRate}`);
      }
      if (heapRate !== null && heapRate !== 0) {
        rates.push(`Heap ${heapRate > 0 ? '+' : ''}${heapRate}MB`);
      }
      if (rates.length > 0) {
        growthRate = `<div style="color:#888;font-size:9px;margin-top:2px">30s: ${rates.join(', ')}</div>`;
      }
    }

    const syncPaused = this.isDebugSyncPaused();
    const syncBtnColor = syncPaused ? '#ff6666' : '#00ff00';
    const syncBtnText = syncPaused ? '▶ Resume Sync' : '⏸ Pause Sync';

    this.overlayElement.innerHTML = `
      <span style="position:absolute;top:2px;right:6px;cursor:pointer;font-size:14px;color:#ff6666" onclick="this.parentElement.remove()">✕</span>
      <div style="margin-bottom:4px;color:#888">⏱ ${timeStr}</div>
      <div>JS Heap: ${heapInfo}</div>
      <div>Storage: ${storageInfo}</div>
      <div>DOM: ${snapshot.domNodes} (<span style="color:${domColor}">${domGrowthStr}</span>)</div>
      ${growthRate}
      <div style="margin-top:6px;border-top:1px solid #444;padding-top:6px">
        <button id="debug-sync-toggle" style="background:${syncBtnColor};color:#000;border:none;padding:4px 8px;border-radius:4px;font-size:10px;cursor:pointer;width:100%">${syncBtnText}</button>
      </div>
    `;

    // Add click handler for sync toggle
    const syncBtn = this.overlayElement.querySelector('#debug-sync-toggle');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.toggleDebugSyncPause();
        this.updateOverlay(); // Refresh to show new state
      });
    }
  }

  /**
   * Get memory history for analysis
   */
  getMemoryHistory(): MemorySnapshot[] {
    return [...this.memoryHistory];
  }

  /**
   * Export memory history as JSON
   */
  exportMemoryHistory(): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      initialSnapshot: this.initialSnapshot,
      history: this.memoryHistory,
      summary: this.getMemorySummary()
    }, null, 2);
  }

  /**
   * Get summary of memory growth
   */
  private getMemorySummary(): object | null {
    if (this.memoryHistory.length < 2 || !this.initialSnapshot) {
      return null;
    }

    const latest = this.memoryHistory[this.memoryHistory.length - 1];
    const elapsedMs = latest.timestamp - this.initialSnapshot.timestamp;

    return {
      elapsedSeconds: Math.round(elapsedMs / 1000),
      domNodeGrowth: latest.domNodes - this.initialSnapshot.domNodes,
      heapGrowthMB: latest.heapUsedMB !== null && this.initialSnapshot.heapUsedMB !== null
        ? Math.round((latest.heapUsedMB - this.initialSnapshot.heapUsedMB) * 10) / 10
        : null,
      snapshotCount: this.memoryHistory.length
    };
  }

  // ===== Debug Sync Pause (for isolating PouchDB as crash cause) =====

  /**
   * Check if sync is paused for debugging
   */
  isDebugSyncPaused(): boolean {
    return localStorage.getItem(this.DEBUG_SYNC_PAUSE_KEY) === 'true';
  }

  /**
   * Toggle debug sync pause state
   */
  toggleDebugSyncPause(): void {
    const currentState = this.isDebugSyncPaused();
    if (currentState) {
      localStorage.removeItem(this.DEBUG_SYNC_PAUSE_KEY);
      console.info('[MobileDebug] Debug sync pause DISABLED - sync will resume');
    } else {
      localStorage.setItem(this.DEBUG_SYNC_PAUSE_KEY, 'true');
      console.info('[MobileDebug] Debug sync pause ENABLED - sync will stop');
    }
    // Dispatch event so DatabaseService can react
    window.dispatchEvent(new CustomEvent('debug-sync-toggle', { detail: { paused: !currentState } }));
  }

  /**
   * Clear debug sync pause state
   */
  clearDebugSyncPause(): void {
    localStorage.removeItem(this.DEBUG_SYNC_PAUSE_KEY);
  }
}
