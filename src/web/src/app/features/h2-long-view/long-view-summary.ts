import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { ValueHeard } from './long-view.logic';

/** "Values you heard" across every long view, with a count where one was heard more than once,
 * and "2 of 4 long views" (issue #58). Presentational: the page renders it only once a live long
 * view exists. */
@Component({
  selector: 'app-long-view-summary',
  imports: [AppNumberPipe, MatCardModule, MatChipsModule, TranslocoPipe],
  templateUrl: './long-view-summary.html',
  styleUrl: './long-view-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongViewSummary {
  readonly values = input.required<readonly ValueHeard[]>();
  /** Distinct scenarios with a complete long view. */
  readonly completed = input.required<number>();
}
