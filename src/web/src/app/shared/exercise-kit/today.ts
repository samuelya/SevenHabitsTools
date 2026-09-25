import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { localDateString } from './assessment-history.logic';
import { CLOCK } from '../../core/time/clock';

/** A second past the next local midnight after `now`, in ms: a timer set for it fires once the
 * date has changed, even with a little timer jitter. Never less than a second. */
export function msUntilNextLocalDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * The local date (`YYYY-MM-DD`) of `CLOCK`, as a signal that changes when the date does: a page
 * left open past midnight recomputes "overdue" and "due today" (issue #57). A timer re-reads the
 * clock just after each local midnight, and a tab coming back into view re-reads it too, because a
 * sleeping device can fire the timer late. Call in an injection context; the timer stops with it.
 */
export function todaySignal(): Signal<string> {
  const clock = inject(CLOCK);
  const today = signal(localDateString(clock.now()));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const refresh = (): void => {
    const now = clock.now();
    today.set(localDateString(now));
    clearTimeout(timer);
    timer = setTimeout(refresh, msUntilNextLocalDay(now));
  };
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };

  timer = setTimeout(refresh, msUntilNextLocalDay(clock.now()));
  document.addEventListener('visibilitychange', onVisible);
  inject(DestroyRef).onDestroy(() => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  });
  return today.asReadonly();
}
