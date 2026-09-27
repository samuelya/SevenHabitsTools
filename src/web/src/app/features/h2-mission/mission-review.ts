import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe, AppNumberPipe } from '../../core/i18n/locale.pipe';
import { REVIEW_INTERVALS, ReviewInterval } from '../../shared/mission/mission.model';

/**
 * The "Review" section (issue #62): how often to reread the statement, the next and last review
 * dates, and "Reviewed today". Presentational: the page computes the dates and stores the changes.
 */
@Component({
  selector: 'app-mission-review',
  imports: [AppDatePipe, AppNumberPipe, MatButtonModule, MatButtonToggleModule, TranslocoPipe],
  templateUrl: './mission-review.html',
  styleUrl: './mission-review.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionReview {
  readonly interval = input.required<ReviewInterval>();
  /** Local midnight of the next review date, `null` while the rhythm is off. */
  readonly nextDate = input<Date | null>(null);
  readonly lastReviewed = input<Date | null>(null);
  readonly intervalChange = output<ReviewInterval>();
  readonly reviewed = output<void>();

  protected readonly intervals = REVIEW_INTERVALS;
  /** "Every 3 months": the number is a param, so it follows the numerals setting. */
  protected readonly quarterMonths = 3;

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  /** Where focus lands once the page's due banner, and the button in it, go away. */
  focusHeading(): void {
    this.heading().nativeElement.focus();
  }
}
