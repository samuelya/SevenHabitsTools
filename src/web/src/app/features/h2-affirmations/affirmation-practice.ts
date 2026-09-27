import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { CLOCK } from '../../core/time/clock';
import {
  clockParts,
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

/** What "Done" closes with. Escape, Close and the backdrop close with no result: nothing logged. */
export interface PracticeDialogResult {
  /** The seconds actually spent, capped at `length`. */
  readonly seconds: number;
  readonly length: PracticeLength;
}

/**
 * The full-screen practice view (issue #64): the affirmation large, its scene, a length choice,
 * Start, a plain countdown and Done. The countdown is `remainingSeconds(startedAt, CLOCK.now())`
 * on every tick, never a decremented counter, so a tab hidden or a device asleep mid-run shows the
 * right time as soon as a tick fires (or the tab is visible again), and Done logs at most the chosen
 * length. Only Done produces a result; the interval stops when the dialog is destroyed, however it
 * closes (design check on #64).
 */
@Component({
  selector: 'app-affirmation-practice',
  imports: [
    AppNumberPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogActions,
    MatDialogClose,
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
  private readonly clock = inject(CLOCK);
  private readonly injector = inject(Injector);

  protected readonly lengths = PRACTICE_LENGTHS;
  protected readonly twoDigits: Intl.NumberFormatOptions = { minimumIntegerDigits: 2 };

  protected readonly length = signal<PracticeLength>(this.data.length);
  /** When Start was pressed (ms, `CLOCK`), `null` before. */
  private readonly startedAt = signal<number | null>(null);
  /** The last clock reading (ms), refreshed on every tick. */
  private readonly now = signal(0);

  protected readonly started = computed(() => this.startedAt() !== null);
  protected readonly remaining = computed(() => {
    const startedAt = this.startedAt();
    return startedAt === null
      ? this.length()
      : remainingSeconds(startedAt, this.now(), this.length());
  });
  protected readonly time = computed(() => clockParts(this.remaining()));
  protected readonly announcement = computed(() =>
    this.started() ? practiceAnnouncement(this.remaining(), this.length()) : null,
  );

  private readonly doneButton = viewChild('doneButton', { read: ElementRef });
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // A hidden tab throttles the interval; coming back re-reads the clock at once.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        this.tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      document.removeEventListener('visibilitychange', onVisible);
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
    const now = this.clock.now().getTime();
    this.now.set(now);
    this.startedAt.set(now);
    this.timer = setInterval(() => this.tick(), PRACTICE_TICK_MS);
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
    this.stop();
    const seconds = secondsSpent(startedAt, this.clock.now().getTime(), this.length());
    this.dialogRef.close({ seconds, length: this.length() });
  }

  private tick(): void {
    if (this.startedAt() === null) {
      return;
    }
    this.now.set(this.clock.now().getTime());
    if (this.remaining() === 0) {
      this.stop();
    }
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
