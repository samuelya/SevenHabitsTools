import { InjectionToken, inject } from '@angular/core';
import { WINDOW } from './window';

/** The slice of `localStorage` the heartbeat writer-lock fallback (`HeartbeatWriterLock`, #35)
 * needs, behind a token so tests can supply an in-memory fake instead of real browser storage. */
export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const LOCAL_STORAGE = new InjectionToken<LocalStorageLike>('LOCAL_STORAGE', {
  providedIn: 'root',
  factory: () => inject(WINDOW).localStorage,
});
