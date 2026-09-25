import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import {
  CommitmentsSummary as CommitmentsSummaryData,
  SUMMARY_WINDOW_DAYS,
} from './commitments.logic';

/** "How you're doing" (issue #57): the kept rate for the last 30 days and for all time, "Kept 4 of
 * 5 (80%)". Presentational: the page renders it only once something is Kept or Broken
 * (`summarize()`), and the 30-day line only when that window has a resolved promise, so no zero
 * is ever shown. Numbers follow the numerals setting (`appNumber`). */
@Component({
  selector: 'app-commitments-summary',
  imports: [AppNumberPipe, MatCardModule, TranslocoPipe],
  templateUrl: './commitments-summary.html',
  styleUrl: './commitments-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitmentsSummary {
  readonly summary = input.required<CommitmentsSummaryData>();
  protected readonly windowDays = SUMMARY_WINDOW_DAYS;
}
