import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { SuccessRatio } from './rehearsal.logic';

/** The counts card (issue #55): of the rehearsals followed up, how many went as planned. Purely
 * presentational; plural-correct through `AppPluralPipe`. */
@Component({
  selector: 'app-rehearsal-summary',
  imports: [MatCardModule, AppPluralPipe],
  templateUrl: './rehearsal-summary.html',
  styleUrl: './rehearsal-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RehearsalSummary {
  readonly summary = input.required<SuccessRatio>();
}
