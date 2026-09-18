import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { MaturitySummaryData } from './maturity.logic';
import { MaturityLevel } from './maturity.model';

/** The footer's counts card: how many assessments exist and the most recent one's overall
 * profile. Purely presentational — `summary` is computed by the page from `maturity.logic.ts`'s
 * `summarize()`, `profileLabels` from its `translateSignal`-backed labels. Plural-correct through
 * `AppPluralPipe`, not a plain `TranslocoPipe` interpolation (playbook §5). */
@Component({
  selector: 'app-maturity-summary',
  imports: [MatCardModule, AppPluralPipe, TranslocoPipe],
  templateUrl: './maturity-summary.html',
  styleUrl: './maturity-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaturitySummary {
  readonly summary = input.required<MaturitySummaryData>();
  readonly profileLabels = input.required<Record<MaturityLevel, string>>();
}
