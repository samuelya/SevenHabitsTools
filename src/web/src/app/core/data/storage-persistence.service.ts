import { Injectable, Signal, inject, signal } from '@angular/core';
import { NAVIGATOR_STORAGE } from '../browser/storage-manager';

export interface StorageEstimateInfo {
  readonly usageBytes: number;
  readonly quotaBytes: number;
}

/**
 * Wraps `navigator.storage`: asks the browser not to evict this app's data under storage pressure
 * (`persist()`) and exposes the current usage/quota estimate for the Settings page. The only thing
 * that talks to the Storage Manager API directly, so Settings itself stays a thin read of these
 * signals.
 */
@Injectable({ providedIn: 'root' })
export class StoragePersistenceService {
  private readonly storageManager = inject(NAVIGATOR_STORAGE);

  private readonly persistedSignal = signal<boolean | null>(null);
  private readonly estimateSignal = signal<StorageEstimateInfo | null>(null);

  /** `null` until `requestPersistence()` resolves, or in browsers without the Storage Manager API. */
  readonly persisted: Signal<boolean | null> = this.persistedSignal.asReadonly();
  /** `null` until the estimate is available, or in browsers without the Storage Manager API. */
  readonly estimate: Signal<StorageEstimateInfo | null> = this.estimateSignal.asReadonly();

  /** Requests persistent storage and refreshes the estimate. A no-op in browsers without the
   * Storage Manager API. Never throws: a browser declining the request still leaves `persisted`
   * at `false`, not an error. */
  async requestPersistence(): Promise<void> {
    if (!this.storageManager) {
      return;
    }
    try {
      this.persistedSignal.set(await this.storageManager.persist());
    } catch {
      this.persistedSignal.set(false);
    }
    await this.refreshEstimate();
  }

  async refreshEstimate(): Promise<void> {
    if (!this.storageManager) {
      return;
    }
    try {
      const { usage, quota } = await this.storageManager.estimate();
      if (usage !== undefined && quota !== undefined) {
        this.estimateSignal.set({ usageBytes: usage, quotaBytes: quota });
      }
    } catch {
      // Leave the previous estimate (or null) in place: a failed refresh is not itself news.
    }
  }
}
