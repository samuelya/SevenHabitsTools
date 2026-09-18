import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { TeachSummary as TeachSummaryData } from './teach.logic';

/** The counts card (issue #52's acceptance criteria): how many of the ten chapters have been
 * shared, and how many are overdue. Purely presentational — `summary` is computed by the page
 * from `teach.logic.ts`'s `summarize()`. Plural-correct in every language through `AppPluralPipe`
 * (playbook's "Counts are plural-correct" section), not a plain `TranslocoPipe` interpolation. */
@Component({
  selector: 'app-teach-summary',
  imports: [MatCardModule, AppPluralPipe],
  templateUrl: './teach-summary.html',
  styleUrl: './teach-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachSummary {
  readonly summary = input.required<TeachSummaryData>();
}
