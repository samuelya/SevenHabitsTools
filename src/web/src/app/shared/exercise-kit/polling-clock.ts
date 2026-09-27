import { DOCUMENT, DestroyRef, Signal, inject, signal } from '@angular/core';
import { CLOCK } from '../../core/time/clock';

export interface PollingClock {
  readonly now: Signal<Date>;
  /** Re-reads the clock at once: after an action stamped with `CLOCK` (starting a day, starting a
   * practice), so `now` is never behind the time just stored. */
  refresh(): void;
  /** Stops the periodic re-read early (a countdown that reached zero). The tab-visible re-read
   * stays until the injection context is destroyed. */
  stop(): void;
}

/**
 * `CLOCK`'s time as a signal re-read every `periodMs` and whenever the tab comes back into view
 * (issues #54, #64). Anything derived from it is computed, never stored or decremented, so a tab
 * hidden or asleep shows the right state as soon as it is visible again, whatever the browser did
 * to its timers meanwhile. `periodMs` is only a redraw rate: a read that leaves a derived value
 * alone changes nothing in the DOM. Call in an injection context; the timer stops with it.
 */
export function pollingClock(periodMs: number): PollingClock {
  const clock = inject(CLOCK);
  const document = inject(DOCUMENT);
  const now = signal(clock.now());
  const refresh = (): void => now.set(clock.now());
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };

  let timer: ReturnType<typeof setInterval> | undefined = setInterval(refresh, periodMs);
  const stop = (): void => {
    clearInterval(timer);
    timer = undefined;
  };
  document.addEventListener('visibilitychange', onVisible);
  inject(DestroyRef).onDestroy(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisible);
  });
  return { now: now.asReadonly(), refresh, stop };
}
