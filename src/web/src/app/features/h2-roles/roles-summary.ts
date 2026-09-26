import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { RolesSummary as RolesSummaryData } from './roles.logic';

/** "Your picture" (issue #59): "4 roles, 3 rated" and, once one is rated, "Average 3.3 of 5".
 * Presentational: the page renders it only once a counted role exists (`summarize()`), so no zero
 * is ever shown. Plural-correct through `AppPluralPipe`; numbers follow the numerals setting. */
@Component({
  selector: 'app-roles-summary',
  imports: [AppNumberPipe, AppPluralPipe, MatCardModule, TranslocoPipe],
  templateUrl: './roles-summary.html',
  styleUrl: './roles-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesSummary {
  readonly summary = input.required<RolesSummaryData>();
  protected readonly averageFormat: Intl.NumberFormatOptions = {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  };
}
