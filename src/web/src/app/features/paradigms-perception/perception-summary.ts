import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { PerceptionProgress } from './perception.logic';

/** The footer's progress card (issue #48's acceptance criteria): how many of the 3 fixed steps
 * are complete. Purely presentational — `summary` is computed by the page from
 * `perception.logic.ts`'s `summarize()`. Plural-correct in every language through `AppPluralPipe`
 * (playbook's "Counts are plural-correct" section), not a plain `TranslocoPipe` interpolation. */
@Component({
  selector: 'app-perception-summary',
  imports: [MatCardModule, AppPluralPipe],
  templateUrl: './perception-summary.html',
  styleUrl: './perception-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerceptionSummary {
  readonly summary = input.required<PerceptionProgress>();
}
