import { InjectionToken, Signal, inject, signal } from '@angular/core';
import { WINDOW } from './window';

/**
 * `navigator.onLine`, kept live via the `online`/`offline` window events, behind a token so specs
 * can substitute a fixed signal instead of real connectivity. Used by the shell's offline
 * indicator (#27) today; the sync engine (#44, architecture issue #1 §5) is a second, already
 * planned consumer for its `online` trigger, which is what earns this its own DI seam instead of
 * being read ad hoc from `WINDOW`.
 */
export const ONLINE_STATUS = new InjectionToken<Signal<boolean>>('ONLINE_STATUS', {
  providedIn: 'root',
  factory: () => {
    const window = inject(WINDOW);
    const online = signal(window.navigator.onLine);
    window.addEventListener('online', () => online.set(true));
    window.addEventListener('offline', () => online.set(false));
    return online.asReadonly();
  },
});
