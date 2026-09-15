import { Injectable, OnDestroy, Signal, inject } from '@angular/core';
import { LOCAL_STORAGE } from '../../browser/local-storage';
import { WEB_LOCKS } from '../../browser/web-locks';
import { WINDOW } from '../../browser/window';
import { HeartbeatWriterLock } from './heartbeat-writer-lock';
import { WebLocksWriterLock } from './web-locks-writer-lock';
import { WriterLockStrategy } from './writer-lock-strategy';
import { WriterRole } from './writer-role-state';

/**
 * This tab's single cross-tab write lock: the Web Locks API when the browser supports it
 * (`WebLocksWriterLock`), or the `localStorage` heartbeat fallback otherwise
 * (`HeartbeatWriterLock`) — chosen once, at construction, and delegated to for the rest of this
 * service's life, so every caller sees one `WriterLockStrategy` regardless of which the browser
 * ended up using. Bound to the `WRITER_LOCK` token in `app.config.ts` once the IndexedDB adapter
 * is wired in.
 */
@Injectable({ providedIn: 'root' })
export class WriterLockService implements WriterLockStrategy, OnDestroy {
  private readonly strategy: WriterLockStrategy;
  readonly role: Signal<WriterRole>;
  readonly isWriter: Signal<boolean>;
  readonly promoted: Signal<boolean>;

  constructor() {
    const locks = inject(WEB_LOCKS);
    this.strategy = locks
      ? new WebLocksWriterLock(locks)
      : new HeartbeatWriterLock(inject(LOCAL_STORAGE), inject(WINDOW));
    this.role = this.strategy.role;
    this.isWriter = this.strategy.isWriter;
    this.promoted = this.strategy.promoted;
  }

  private started = false;

  /** Safe to call more than once: the corrupt-recovery import starts the lock on its own, to learn
   * this tab's role before committing anything, and `DocumentSync.start()` starts it again right
   * after (#160). A second lock request would see this tab's own lock held and settle as reader. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.strategy.start();
  }

  stop(): void {
    this.strategy.stop();
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
