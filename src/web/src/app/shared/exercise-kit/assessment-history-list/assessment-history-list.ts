import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../../core/i18n/plural.pipe';
import { SwipeToDeleteDirective } from '../swipe-to-delete.directive';
import {
  isValidIsoDate,
  parseIsoDate,
  type AssessmentHistoryItem,
} from '../assessment-history.logic';

/** Rows are built by `assessmentHistoryItems()` (`assessment-history.logic.ts`, issue #226): the
 * raw `YYYY-MM-DD` date plus a result summary as a translation key. Both are resolved here, in the
 * template — the date through `AppDatePipe`, the summary through `appPlural`/`transloco` — not
 * pre-formatted by the caller, so a row stays correct across a language switch (both pipes are
 * impure and re-read the active language; a label built once in a page's own `computed()` would
 * freeze at whichever language was active on first render — the "frozen label" trap the
 * playbook's "Reactive labels" section documents for `translateSignal`). */
export type { AssessmentHistoryItem } from '../assessment-history.logic';

/**
 * The read-only, newest-first log every **assessment** exercise (playbook §4) shows alongside its
 * editor — `PcBalancePage`'s and `MaturityPage`'s shared presentational shell, the same role
 * `ExerciseList` plays for the **list** type. It doesn't search or sort: an assessment history is
 * a chronological record, not a searchable collection, so ordering is entirely the caller's
 * (`sortedByDateDesc`, `assessment-history.logic.ts`) — this component only renders whatever order
 * `items()` is given, in it.
 */
@Component({
  selector: 'app-assessment-history-list',
  imports: [
    AppDatePipe,
    AppPluralPipe,
    MatIconModule,
    MatListModule,
    SwipeToDeleteDirective,
    TranslocoPipe,
  ],
  templateUrl: './assessment-history-list.html',
  styleUrl: './assessment-history-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentHistoryList<T extends AssessmentHistoryItem = AssessmentHistoryItem> {
  readonly items = input.required<readonly T[]>();
  readonly selectedId = input<string | null>(null);
  readonly emptyMessage = input.required<string>();
  /** Opt-in (issue #203), same reasoning as `ExerciseList.deletable` — off by default so a future
   * caller that doesn't wire a delete handler doesn't grow one it never listens to. */
  readonly deletable = input(false);
  readonly itemSelected = output<string>();
  /** Requested by a bin-button click or a committed swipe on a deletable row (playbook's "Deleting
   * entries"); the caller runs confirm → delete → undo (`DeleteWithUndo`). */
  readonly deleteRequested = output<string>();

  /** Local midnight, not `new Date(item.date)`'s UTC midnight (`parseIsoDate`'s doc comment): a
   * raw `YYYY-MM-DD` string can't go through `AppDatePipe` directly. */
  protected localDate(date: string): Date {
    return parseIsoDate(date);
  }

  protected isValidDate(date: string): boolean {
    return isValidIsoDate(date);
  }

  protected requestDelete(item: T): void {
    if (this.deletable()) {
      this.deleteRequested.emit(item.id);
    }
  }
}
