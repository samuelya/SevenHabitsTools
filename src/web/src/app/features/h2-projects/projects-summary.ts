import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { ProjectsSummary as ProjectsSummaryData } from './projects.logic';

/** "3 projects, 1 done" and, once a step exists, "4 of 9 steps done" (issue #65). Presentational:
 * the page renders it only once a counted project exists (`summarize()`), so no zero is shown. */
@Component({
  selector: 'app-projects-summary',
  imports: [AppNumberPipe, AppPluralPipe, MatCardModule, TranslocoPipe],
  templateUrl: './projects-summary.html',
  styleUrl: './projects-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsSummary {
  readonly summary = input.required<ProjectsSummaryData>();
}
