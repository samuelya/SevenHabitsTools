import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
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
  readonly itemSelected = output<string>();

  protected readonly query = signal('');
  protected readonly sort = signal<ExerciseListSort>('title');

  /** Search and sort only once there's enough to search/sort through (#186). */
  protected readonly showTools = computed(() => this.items().length >= LIST_TOOLS_MIN_ITEMS);

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
}
