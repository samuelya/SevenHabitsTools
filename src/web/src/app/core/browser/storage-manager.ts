import { InjectionToken, inject } from '@angular/core';
import { WINDOW } from './window';

/** DI seam for `navigator.storage` (the Storage Manager API): `persist()` and `estimate()`.
 * `undefined` in browsers (and the unit-test `jsdom` environment) that don't support it. */
export const NAVIGATOR_STORAGE = new InjectionToken<StorageManager | undefined>(
  'NAVIGATOR_STORAGE',
  {
    providedIn: 'root',
    factory: () => inject(WINDOW).navigator.storage,
  },
);
