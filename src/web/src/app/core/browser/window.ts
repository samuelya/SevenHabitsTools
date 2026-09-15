import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';

/** DI seam for `window`, alongside Angular's own `DOCUMENT` token, so services can listen for
 * `window` events (e.g. `pagehide`) without a hard reference to the global. */
export const WINDOW = new InjectionToken<Window>('WINDOW', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).defaultView ?? window,
});
