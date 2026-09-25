import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { CircleSummary as CircleSummaryData } from './circle.logic';

/** The counts card (issue #53): how many of the things the user can affect have a first step.
 * Purely presentational; plural-correct through `AppPluralPipe`. */
@Component({
  selector: 'app-circle-summary',
  imports: [MatCardModule, AppPluralPipe],
  templateUrl: './circle-summary.html',
  styleUrl: './circle-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleSummary {
  readonly summary = input.required<CircleSummaryData>();
}
