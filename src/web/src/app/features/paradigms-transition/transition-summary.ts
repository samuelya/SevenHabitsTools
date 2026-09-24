import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { TransitionSummary as TransitionSummaryData } from './transition.logic';

/** The counts card (issue #51's acceptance criteria): how many counted scripts are decided to
 * stop or be rewritten, out of the total named. Purely presentational — `summary` is computed by the
 * page from `transition.logic.ts`'s `summarize()`. Plural-correct in every language through
 * `AppPluralPipe` (issue #187), not a plain `TranslocoPipe` interpolation. */
@Component({
  selector: 'app-transition-summary',
  imports: [MatCardModule, AppPluralPipe],
  templateUrl: './transition-summary.html',
  styleUrl: './transition-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransitionSummary {
  readonly summary = input.required<TransitionSummaryData>();
}
