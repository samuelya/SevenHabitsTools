import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { pollingClock } from '../../shared/exercise-kit/polling-clock';
import {
  PracticeResult,
  clockParts,
  isLoggable,
  practiceAnnouncement,
  remainingSeconds,
  secondsSpent,
} from './affirmations.logic';
import { PRACTICE_LENGTHS, PracticeLength } from './affirmations.model';

/** How often a running countdown re-reads the clock. Only a redraw rate: the time shown is always
 * computed from the clock, so a slower or late tick never makes it wrong. */
export const PRACTICE_TICK_MS = 250;

export interface PracticeDialogData {
  readonly text: string;
  readonly scene?: string;
  /** The length the dialog starts on (the affirmation's last choice). */
  readonly length: PracticeLength;
}

/** What "Done" closes with, once at least `MIN_PRACTICE_SECONDS` were spent. Escape, Close, the
 * backdrop and an earlier Done close with no result: nothing logged. */
export type PracticeDialogResult = PracticeResult;

/**
 * The full-screen practice view (issue #64): the affirmation large, its scene, a length choice,
 * Start, a plain countdown and Done. The countdown is `remainingSeconds(startedAt, CLOCK.now())`
 * on every tick, never a decremented counter, so a tab hidden or a device asleep mid-run shows the
 * right time as soon as a tick fires (or the tab is visible again), and Done logs at most the chosen
 * length. Only Done produces a result, and only from 5 seconds on; the clock (`pollingClock()`)
 * stops when the dialog is destroyed, however it closes (design check on #64).
 */
@Component({
  selector: 'app-affirmation-practice',
  imports: [
    AppNumberPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './affirmation-practice.html',
  styleUrl: './affirmation-practice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffirmationPractice {
  protected readonly data = inject<PracticeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<AffirmationPractice, PracticeDialogResult>>(MatDialogRef);
  private readonly clock = pollingClock(PRACTICE_TICK_MS);
  private readonly injector = inject(Injector);

  protected readonly lengths = PRACTICE_LENGTHS;
  protected readonly twoDigits: Intl.NumberFormatOptions = { minimumIntegerDigits: 2 };

  protected readonly length = signal<PracticeLength>(this.data.length);
  /** When Start was pressed (ms, `CLOCK`), `null` before. */
  private readonly startedAt = signal<number | null>(null);

  protected readonly started = computed(() => this.startedAt() !== null);
  protected readonly remaining = computed(() => {
    const startedAt = this.startedAt();
    return startedAt === null
      ? this.length()
      : remainingSeconds(startedAt, this.clock.now().getTime(), this.length());
  });
  /** Started, but not yet long enough for Done to log: the dialog says so before Done is pressed. */
  protected readonly tooShort = computed(() => {
    const startedAt = this.startedAt();
    return (
      startedAt !== null &&
      !isLoggable(secondsSpent(startedAt, this.clock.now().getTime(), this.length()))
    );
  });
  protected readonly time = computed(() => clockParts(this.remaining()));
  protected readonly announcement = computed(() =>
    this.started() ? practiceAnnouncement(this.remaining(), this.length()) : null,
  );

  private readonly doneButton = viewChild('doneButton', { read: ElementRef });

  constructor() {
    // The poll only redraws; once the countdown reaches zero it has nothing left to show.
    effect(() => {
      if (this.started() && this.remaining() === 0) {
        this.clock.stop();
      }
    });
  }

  protected onLengthChange(length: PracticeLength): void {
    if (!this.started()) {
      this.length.set(length);
    }
  }

  protected start(): void {
    if (this.started()) {
      return;
    }
    this.clock.refresh();
    this.startedAt.set(this.clock.now().getTime());
    // Start is replaced by Done: move focus there once it is rendered, so it never drops to the
    // dialog container.
    afterNextRender(() => (this.doneButton()?.nativeElement as HTMLElement | undefined)?.focus(), {
      injector: this.injector,
    });
  }

  protected done(): void {
    const startedAt = this.startedAt();
    if (startedAt === null) {
      return;
    }
    this.clock.stop();
    this.clock.refresh();
    const seconds = secondsSpent(startedAt, this.clock.now().getTime(), this.length());
    this.dialogRef.close(isLoggable(seconds) ? { seconds, length: this.length() } : undefined);
  }

  /** The header's Close: no result, before or after Start (as Escape and the backdrop). */
  protected close(): void {
    this.dialogRef.close();
  }
}
