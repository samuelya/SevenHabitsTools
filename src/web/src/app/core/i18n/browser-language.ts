import { InjectionToken, inject } from '@angular/core';
import { WINDOW } from '../browser/window';

/** DI seam for `navigator.language`, alongside `WINDOW`, so `resolveDefaultLanguage()`'s caller
 * is unit-testable without a real browser locale. `null` when the platform has no `navigator`
 * (e.g. the unit-test environment, depending on configuration). */
export const BROWSER_LANGUAGE = new InjectionToken<string | null>('BROWSER_LANGUAGE', {
  providedIn: 'root',
  factory: () => inject(WINDOW).navigator?.language ?? null,
});
