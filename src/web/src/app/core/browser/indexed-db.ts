import { InjectionToken, inject } from '@angular/core';
import { WINDOW } from './window';

/** DI seam for the `indexedDB` global, so `IndexedDbAdapter` (#35) can be swapped onto
 * `fake-indexeddb` in tests instead of exercising a real browser database. `undefined` in
 * environments without IndexedDB (e.g. the unit-test `jsdom` environment). */
export const INDEXED_DB = new InjectionToken<IDBFactory | undefined>('INDEXED_DB', {
  providedIn: 'root',
  factory: () => inject(WINDOW).indexedDB,
});
