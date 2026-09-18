import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { AppDatePipe } from '../../../core/i18n/locale.pipe';
import { parseIsoDate } from '../assessment-history.logic';

/** One row `AssessmentHistoryList` renders. `date` is the raw `YYYY-MM-DD` the row is for —
 * formatted by this component through `AppDatePipe`, not pre-formatted by the caller, so the row
 * stays correct across a language switch (`AppDatePipe` is impure and re-reads the active
 * language on every change-detection run; a title string built once in a page's own `computed()`
 * would otherwise freeze at whichever language was active on first render — the same "frozen
 * label" trap the playbook's "Reactive labels" section documents for `translateSignal`).
 * `subtitle` is already-translated display text, not a key. */
export interface AssessmentHistoryItem {
  readonly id: string;
  readonly date: string;
  readonly subtitle?: string;
}

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
  imports: [AppDatePipe, MatListModule],
  templateUrl: './assessment-history-list.html',
  styleUrl: './assessment-history-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentHistoryList<T extends AssessmentHistoryItem = AssessmentHistoryItem> {
  readonly items = input.required<readonly T[]>();
  readonly selectedId = input<string | null>(null);
  readonly emptyMessage = input.required<string>();
  readonly itemSelected = output<string>();

  /** Local midnight, not `new Date(item.date)`'s UTC midnight — see `AssessmentHistoryItem`'s own
   * doc comment on `date` for why a raw `YYYY-MM-DD` string can't go through `AppDatePipe`
   * directly. */
  protected localDate(date: string): Date {
    return parseIsoDate(date);
  }
}
