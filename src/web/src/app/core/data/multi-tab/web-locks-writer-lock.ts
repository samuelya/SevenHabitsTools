import { WriterLockStrategy } from './writer-lock-strategy';
import { WriterRoleState } from './writer-role-state';

/** Name of the single cross-tab write lock every tab of this app contends for. */
export const WRITER_LOCK_NAME = 'sevenhabits-writer';

/**
 * Acquires the write lock through the Web Locks API (`navigator.locks.request`). The browser
 * queues concurrent requests for the same lock name and grants it to one holder at a time,
 * releasing it automatically when that tab is closed or navigates away, so this class only ever
 * needs to ask for the lock, never to give it back in normal operation.
 *
 * `start()` first asks with `ifAvailable: true`, which settles straight away either way: granted
 * means this tab is the writer from the start (never a promotion, however slowly the browser
 * answered); `null` means another tab holds it, so this tab is *confirmed* read-only, and only then
 * queues a normal waiting request whose grant is a real promotion (#125).
 *
 * `stop()` exists for this app's own teardown (e.g. tests): it aborts a waiting request via
 * `AbortController`, or, if the lock was already granted, resolves the held callback's promise so
 * the browser releases it.
 */
export class WebLocksWriterLock implements WriterLockStrategy {
  private readonly state = new WriterRoleState();
  readonly role = this.state.role;
  readonly isWriter = this.state.isWriter;
  readonly promoted = this.state.promoted;

  private stopped = false;
  private abortController: AbortController | undefined;
  private release: (() => void) | undefined;

  constructor(private readonly locks: LockManager) {}

  start(): void {
    // `ifAvailable` can't be combined with an abort `signal`; `stop()` is handled in the callback.
    this.locks
      .request(WRITER_LOCK_NAME, { ifAvailable: true }, (lock) =>
        lock ? this.holdUntilReleased() : this.waitForLock(),
      )
      .catch(() => this.stayReader());
  }

  stop(): void {
    this.stopped = true;
    this.abortController?.abort();
    this.release?.();
    this.state.reset();
  }

  /** Another tab holds the lock: this tab is confirmed read-only and queues for the lock. */
  private waitForLock(): void {
    if (this.stopped) {
      return;
    }
    this.state.deny();
    this.abortController = new AbortController();
    this.locks
      .request(WRITER_LOCK_NAME, { signal: this.abortController.signal }, () =>
        this.holdUntilReleased(),
      )
      .catch(() => this.stayReader());
  }

  private holdUntilReleased(): Promise<void> {
    if (this.stopped) {
      return Promise.resolve();
    }
    this.state.grant();
    // Resolves once `stop()` calls `release()`; in practice the browser releases the lock (and
    // abandons this promise) when the tab closes or navigates away instead.
    return new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  /** Aborted by our own `stop()`, or the browser could not grant the lock at all; either way this
   * tab never writes. */
  private stayReader(): void {
    if (!this.stopped) {
      this.state.deny();
    }
  }
}
