import { Injectable, Injector, effect, inject } from '@angular/core';
import { WINDOW } from '../../browser/window';
import { WRITER_LOCK } from './writer-lock';

/**
 * Even an uncontended writer lock grant is asynchronous: every tab's `isWriter()` starts `false`
 * (the strategy's default before its lock request settles) and flips `true` a moment later, so a
 * bare `false → true` transition alone can't tell "just finished starting up as the writer" from
 * "was genuinely read-only, and only now got promoted because the previous writer's tab closed".
 * A transition only counts as a real promotion once this much time has passed since `start()` —
 * comfortably longer than an uncontended grant ever takes, comfortably shorter than a real wait
 * for another tab to close.
 */
export const PROMOTION_SETTLE_MS = 500;

/**
 * A tab that starts read-only and later acquires the write lock (because the previous writer's
 * tab closed) reloads the page, rather than trying to resume mid-session: it may hold a stale
 * in-memory document from before the other tab's last save, and a full reload re-runs bootstrap
 * against whatever is actually stored instead of risking an overwrite with stale data. A tab that
 * is (or promptly becomes) the writer when this starts does nothing — see `PROMOTION_SETTLE_MS`.
 */
@Injectable({ providedIn: 'root' })
export class WriterPromotionReload {
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly window = inject(WINDOW);
  private readonly injector = inject(Injector);

  private started = false;
  private wasWriter: boolean | null = null;
  private startedAt = 0;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.startedAt = Date.now();

    effect(
      () => {
        const isWriter = this.writerLock.isWriter();
        const settled = Date.now() - this.startedAt >= PROMOTION_SETTLE_MS;
        if (this.wasWriter === false && isWriter && settled) {
          this.window.location.reload();
        }
        this.wasWriter = isWriter;
      },
      { injector: this.injector },
    );
  }
}
