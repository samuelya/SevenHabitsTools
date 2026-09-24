import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { SwipeToDeleteDirective } from '../swipe-to-delete.directive';
import {
  ExerciseListItem,
  ExerciseListSort,
  filterExerciseItems,
  LIST_TOOLS_MIN_ITEMS,
  sortExerciseItems,
} from './exercise-list.logic';

/**
 * A searchable, sortable list of exercises (issue #30) — the "list" half of list/detail; pair it
 * with `ExerciseDetail` for the responsive drawer/full-page layout. Purely presentational: filter
 * and sort state live here (they are display concerns, not document data), but `items` and the
 * selection itself are the caller's. `searchLabel`/`emptyMessage`/`noMatchMessage` are
 * already-translated strings from the calling page's own scope (#186) — the list holds the
 * exercise's *items* (scripts, roles, deposits…), so a generic "exercises" wording here would be
 * wrong for every page that uses it.
 */
@Component({
  selector: 'app-exercise-list',
  imports: [
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    SwipeToDeleteDirective,
    TranslocoPipe,
  ],
  templateUrl: './exercise-list.html',
  styleUrl: './exercise-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseList<T extends ExerciseListItem = ExerciseListItem> {
  readonly items = input.required<readonly T[]>();
  readonly selectedId = input<string | null>(null);
  readonly searchLabel = input.required<string>();
  readonly emptyMessage = input.required<string>();
  /** Shown when items exist but none match the query; defaults to `emptyMessage`. */
  readonly noMatchMessage = input<string>();
  /** The sort the list starts in (issue #52) — `'title'` for an arbitrary add-your-own list (the
   * default every existing caller relies on), `'none'` for a caller whose `items()` order is
   * already meaningful (e.g. book order) and would otherwise be scrambled alphabetically. Read
   * through `sort()` below (a `computed()` falling back to this input, not a plain signal seeded
   * from it): `TestBed.createComponent()` — and, in principle, any caller that sets an input after
   * construction rather than through a template binding present at creation — runs this class's
   * field initializers with every `input()` still at its declared default, so a `signal(this
   * .initialSort())` field initializer would permanently capture `'title'` regardless of what a
   * test's later `componentRef.setInput('initialSort', ...)` sets it to (review finding on #52's
   * PR: the "book order" fix silently didn't apply in exactly that harness).
   */
  readonly initialSort = input<ExerciseListSort>('title');
  /** Opt-in (issue #203): off by default, so a future caller that doesn't wire a delete handler
   * doesn't silently grow a bin button and a swipe gesture nobody listens to. A row can further
   * opt itself out via its own `item.deletable` (`ExerciseListItem`'s own doc comment). */
  readonly deletable = input(false);
  /** Opt-out (issue #224): `false` for a short fixed list (the ten Teach chapters) where search and
   * sort only get in the way; the default keeps them for add-your-own lists. */
  readonly searchable = input(true);
  readonly itemSelected = output<string>();
  /** Requested by a bin-button click or a committed swipe on a deletable row — never both for the
   * same gesture (`SwipeToDeleteDirective` suppresses the click a swipe produces). The caller runs
   * confirm → delete → undo (`DeleteWithUndo`, playbook's "Deleting entries"); this component only
   * ever asks. */
  readonly deleteRequested = output<string>();

  protected readonly query = signal('');
  /** `null` until the user picks a sort explicitly; `sort()` falls back to `initialSort()` until
   * then, so the starting order is whatever the caller asked for but the user's own choice always
   * wins once made. */
  private readonly sortOverride = signal<ExerciseListSort | null>(null);
  protected readonly sort = computed(() => this.sortOverride() ?? this.initialSort());

  /** Search and sort only once there's enough to search/sort through (#186), and only for a
   * caller that wants them (`searchable`, #224). */
  protected readonly showTools = computed(
    () => this.searchable() && this.items().length >= LIST_TOOLS_MIN_ITEMS,
  );

  protected readonly visibleItems = computed(() =>
    sortExerciseItems(filterExerciseItems(this.items(), this.query()), this.sort()),
  );

  protected readonly emptyText = computed(() =>
    this.items().length === 0
      ? this.emptyMessage()
      : (this.noMatchMessage() ?? this.emptyMessage()),
  );

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSortChange(sort: ExerciseListSort): void {
    this.sortOverride.set(sort);
  }

  /** Whether row `item` gets a bin button and swipe-to-delete: the list's own `deletable()` input,
   * further narrowed by the row's own opt-out (`ExerciseListItem.deletable`, `paradigms-teach`'s
   * chapters without an entry yet). */
  protected isRowDeletable(item: T): boolean {
    return this.deletable() && (item.deletable ?? true);
  }

  protected requestDelete(item: T): void {
    if (this.isRowDeletable(item)) {
      this.deleteRequested.emit(item.id);
    }
  }
}
