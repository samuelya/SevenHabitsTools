import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import type { DayCell } from './challenge.logic';
import { CHECKIN_QUESTIONS, CheckIn } from './challenge.model';

/**
 * One day other than tonight's check-in (issue #56): a past check-in read-only, a skipped day with
 * its reason, or a missed day with "Mark skipped" and an optional one-line reason when `canSkip`.
 * Presentational.
 */
@Component({
  selector: 'app-challenge-day-detail',
  imports: [AppDatePipe, MatButtonModule, MatInputModule, TranslocoPipe],
  templateUrl: './challenge-day-detail.html',
  styleUrl: './challenge-day-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengeDayDetail {
  readonly cell = input.required<DayCell>();
  readonly checkin = input<CheckIn | undefined>(undefined);
  readonly canSkip = input(false);
  readonly skipped = output<string>();

  protected readonly questions = CHECKIN_QUESTIONS;
  protected readonly when = computed(() => parseIsoDate(this.cell().date));
  protected readonly reason = signal('');

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  protected skip(): void {
    this.skipped.emit(this.reason());
    this.reason.set('');
  }
}
