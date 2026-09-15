import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { LOCAL_STORAGE } from '../../browser/local-storage';
import { CLOCK } from '../../time/clock';

const STORAGE_KEY = 'sevenhabits-export-reminder-dismissed-until';

/** The local calendar date (`YYYY-MM-DD`) `now` falls on — the browser's local date, not UTC, so
 * "dismissed for the day" (#37) matches what the user means by "today", not whichever UTC day
 * that happens to be at the moment. */
function localDateString(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Remembers, until the end of the current local day, whether the user dismissed the "export your
 * data" reminder banner on Home (#37: "dismissable for the day") — persisted in `localStorage`, so
 * a reload or a new tab on the same day doesn't bring it straight back (#153, a regression from an
 * earlier in-memory-only version that only lasted the tab's session). Kept separate from
 * `BackupSettings` (`backup.model.ts`) since this is local UI state, not user data to save or sync.
 */
@Injectable({ providedIn: 'root' })
export class ExportReminderDismissal {
  private readonly storage = inject(LOCAL_STORAGE);
  private readonly clock = inject(CLOCK);

  private readonly dismissedUntilSignal = signal(this.storage.getItem(STORAGE_KEY));

  readonly dismissed: Signal<boolean> = computed(
    () => this.dismissedUntilSignal() === localDateString(this.clock.now()),
  );

  dismiss(): void {
    const today = localDateString(this.clock.now());
    this.storage.setItem(STORAGE_KEY, today);
    this.dismissedUntilSignal.set(today);
  }
}
