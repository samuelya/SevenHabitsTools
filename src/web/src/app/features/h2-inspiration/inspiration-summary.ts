import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { InspirationSummary as InspirationSummaryData } from './inspiration.logic';

/** "5 in your collection" and "2 favourites", each pluralised on its own number (issue #63).
 * Presentational: the page renders it only once
 * a counted item exists (`summarize()`), so no zero is shown. */
@Component({
  selector: 'app-inspiration-summary',
  imports: [AppPluralPipe, MatCardModule, TranslocoPipe],
  templateUrl: './inspiration-summary.html',
  styleUrl: './inspiration-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspirationSummary {
  readonly summary = input.required<InspirationSummaryData>();
}
