import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { TransitionSummary as TransitionSummaryData } from './transition.logic';

/** The counts card (issue #51's acceptance criteria): how many live scripts are decided to stop
 * or be rewritten, out of the total named. Purely presentational — `summary` is computed by the
 * page from `transition.logic.ts`'s `summarize()`. */
@Component({
  selector: 'app-transition-summary',
  imports: [MatCardModule, TranslocoPipe],
  templateUrl: './transition-summary.html',
  styleUrl: './transition-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransitionSummary {
  readonly summary = input.required<TransitionSummaryData>();
}
