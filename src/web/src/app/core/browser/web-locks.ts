import { InjectionToken, inject } from '@angular/core';
import { WINDOW } from './window';

/** DI seam for the Web Locks API (`navigator.locks`). `undefined` in browsers (and the unit-test
 * `jsdom` environment) that don't support it, so `WriterLockService` (#35) can fall back to the
 * `localStorage` heartbeat instead. */
export const WEB_LOCKS = new InjectionToken<LockManager | undefined>('WEB_LOCKS', {
  providedIn: 'root',
  factory: () => inject(WINDOW).navigator.locks,
});
