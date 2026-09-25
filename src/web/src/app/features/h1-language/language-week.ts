import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';

/** One row of the table: the day's already-formatted name and its counts by kind. */
export interface WeekRow {
  readonly date: string;
  readonly label: string;
  readonly reactive: number;
  readonly proactive: number;
}

/**
 * "Last 7 days" (issue #54): a small table of phrases per day by kind, and the streak line when
 * there is a streak (never a zero counter). Purely presentational; the page renders it only once a
 * counted phrase exists.
 */
@Component({
  selector: 'app-language-week',
  imports: [AppPluralPipe, MatCardModule, TranslocoPipe],
  templateUrl: './language-week.html',
  styleUrl: './language-week.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageWeek {
  readonly rows = input.required<readonly WeekRow[]>();
  readonly streak = input(0);
}
