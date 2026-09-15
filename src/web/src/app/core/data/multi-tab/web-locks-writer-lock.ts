import { Signal, signal } from '@angular/core';
import { WriterLockStrategy } from './writer-lock-strategy';

/** Name of the single cross-tab write lock every tab of this app contends for. */
export const WRITER_LOCK_NAME = 'sevenhabits-writer';

/**
 * Acquires the write lock through the Web Locks API (`navigator.locks.request`). The browser
 * queues concurrent requests for the same lock name and grants it to one holder at a time,
 * releasing it automatically when that tab is closed or navigates away, so this class only ever
 * needs to ask for the lock, never to give it back in normal operation. `stop()` exists for this
 * app's own teardown (e.g. tests): it aborts a pending request via `AbortController`, or, if the
 * lock was already granted, resolves the held callback's promise so the browser releases it.
 */
export class WebLocksWriterLock implements WriterLockStrategy {
  private readonly isWriterSignal = signal(false);
  readonly isWriter: Signal<boolean> = this.isWriterSignal.asReadonly();

  private abortController: AbortController | undefined;
  private release: (() => void) | undefined;

  constructor(private readonly locks: LockManager) {}

  start(): void {
    this.abortController = new AbortController();
    this.locks
      .request(WRITER_LOCK_NAME, { signal: this.abortController.signal }, () =>
        this.holdUntilReleased(),
      )
      .catch(() => {
        // Aborted by our own stop(), or the browser could not grant the lock at all; either way
        // this tab simply stays a reader.
        this.isWriterSignal.set(false);
      });
  }

  stop(): void {
    this.abortController?.abort();
    this.release?.();
    this.isWriterSignal.set(false);
  }

  private holdUntilReleased(): Promise<void> {
    this.isWriterSignal.set(true);
    // Resolves once `stop()` calls `release()`; in practice the browser releases the lock (and
    // abandons this promise) when the tab closes or navigates away instead.
    return new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }
}
