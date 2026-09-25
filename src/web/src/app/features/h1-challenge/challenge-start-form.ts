import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { localDateString, parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';

/** What "Start test" hands the page: the raw start date (`''` when the field doesn't hold a real
 * date; `newChallengeFields()` cleans it) and the focus as typed. */
export interface ChallengeStart {
  readonly startDate: string;
  readonly focus: string;
}

/**
 * The start form (issue #56): start date (default today, no later than today) and an optional
 * focus. Nothing is stored until "Start test": a test with no start is meaningless. Presentational.
 */
@Component({
  selector: 'app-challenge-start-form',
  imports: [MatButtonModule, MatDatepickerModule, MatInputModule, TranslocoPipe],
  templateUrl: './challenge-start-form.html',
  styleUrl: './challenge-start-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengeStartForm {
  readonly today = input.required<string>();
  readonly started = output<ChallengeStart>();

  protected readonly maxDate = computed(() => parseIsoDate(this.today()));
  /** `null` until the user picks a date: the field then shows today. */
  private readonly pickedDate = signal<string | null>(null);
  protected readonly startDate = computed(() => this.pickedDate() ?? this.today());
  protected readonly startDateValue = computed(() => parseIsoDate(this.startDate()));
  private readonly focus = signal('');

  /** A picked or typed valid date is kept; one that doesn't parse (or a cleared field) is kept as
   * `''`, which starts the test today. */
  protected onDateChange(event: MatDatepickerInputEvent<Date>): void {
    this.pickedDate.set(event.value ? localDateString(event.value) : '');
  }

  protected onFocusInput(event: Event): void {
    this.focus.set((event.target as HTMLInputElement).value);
  }

  protected start(): void {
    this.started.emit({ startDate: this.startDate(), focus: this.focus() });
  }
}
