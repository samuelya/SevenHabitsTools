import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { PcBalanceSummaryData } from './pc-balance.logic';

/** The footer's counts card (issue #49's acceptance criteria: "history of past audits"): how many
 * audits exist and the most recent one's overall balance. Purely presentational — `summary` is
 * computed by the page from `pc-balance.logic.ts`'s `summarize()`. Plural-correct through
 * `AppPluralPipe`, not a plain `TranslocoPipe` interpolation (playbook §5). */
@Component({
  selector: 'app-pc-balance-summary',
  imports: [MatCardModule, AppPluralPipe, TranslocoPipe],
  templateUrl: './pc-balance-summary.html',
  styleUrl: './pc-balance-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PcBalanceSummary {
  readonly summary = input.required<PcBalanceSummaryData>();
}
