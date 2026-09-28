import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { AffirmationsSummary as AffirmationsSummaryData } from './affirmations.logic';

/** "Practised 4 days" and, once there is one, "3-day streak" (issue #64). Presentational: the page
 * renders it only once a practice exists (`summarize()`), so no zero is shown. */
@Component({
  selector: 'app-affirmations-summary',
  imports: [AppPluralPipe, MatCardModule, TranslocoPipe],
  templateUrl: './affirmations-summary.html',
  styleUrl: './affirmations-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffirmationsSummary {
  readonly summary = input.required<AffirmationsSummaryData>();
}
