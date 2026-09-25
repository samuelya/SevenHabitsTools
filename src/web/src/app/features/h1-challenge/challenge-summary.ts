import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import type { ChallengeSummary as ChallengeSummaryData } from './challenge.logic';

/** A test's counts (issue #56): the streak, "Checked in 12 of 30 days" and "Kept 4 of 5 promises
 * this month", each only once it is at least 1 (no zero counters). Presentational. */
@Component({
  selector: 'app-challenge-summary',
  imports: [AppPluralPipe, MatCardModule, TranslocoPipe],
  templateUrl: './challenge-summary.html',
  styleUrl: './challenge-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengeSummary {
  readonly summary = input.required<ChallengeSummaryData>();
}
