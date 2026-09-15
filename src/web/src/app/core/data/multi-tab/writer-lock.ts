import { InjectionToken, Signal, signal } from '@angular/core';

/** What consumers (`DocumentPersistence`, `ReadOnlyBanner`) need to know about this tab's write
 * access — nothing more. `WriterLockStrategy` (the concrete `WriterLockService`, #35) additionally
 * knows how to acquire and release the lock; that lifecycle is deliberately not part of this
 * interface (interface segregation) since most consumers only ever read it. */
export interface WriterLockStatus {
  readonly isWriter: Signal<boolean>;
}

/** Default: a single-tab app (or `NoopAdapter` in tests/dev) is always its own writer. Bound to
 * the real `WriterLockService` in `app.config.ts` once the IndexedDB adapter is wired in — nothing
 * else that reads this token needs to change when that happens. */
export const WRITER_LOCK = new InjectionToken<WriterLockStatus>('WRITER_LOCK', {
  providedIn: 'root',
  factory: () => ({ isWriter: signal(true).asReadonly() }),
});
