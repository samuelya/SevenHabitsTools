import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { CLOCK } from '../../core/time/clock';

/** How often the page re-reads the clock (issue #54: a coarse timer, never a per-second tick). */
export const MINUTE_MS = 60_000;

export interface MinuteClock {
  readonly now: Signal<Date>;
  /** Re-reads the clock at once: after an action stamped with `CLOCK` (starting a day), so `now`
   * is never behind the time just stored. */
  refresh(): void;
}

/**
 * `CLOCK`'s time as a signal re-read once a minute and whenever the tab comes back into view
 * (issue #54). The listening day's state is derived from it, never stored, so a tab hidden or
 * asleep at the 24-hour mark shows the day ended as soon as it is visible again, whatever the
 * browser did to its timers meanwhile. A read that leaves a derived value alone (the hours left)
 * changes nothing in the DOM. Call in an injection context; the timer stops with it.
 */
export function minuteClock(): MinuteClock {
  const clock = inject(CLOCK);
  const now = signal(clock.now());
  const refresh = (): void => now.set(clock.now());
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };

  const timer = setInterval(refresh, MINUTE_MS);
  document.addEventListener('visibilitychange', onVisible);
  inject(DestroyRef).onDestroy(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  });
  return { now: now.asReadonly(), refresh };
}
