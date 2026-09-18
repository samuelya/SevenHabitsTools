/** One row `ExerciseList` renders. Generic across every future exercise feature — `title`/
 * `subtitle` are already-translated display text, not keys. */
export interface ExerciseListItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly done?: boolean;
  /** Visually highlights the row (issue #52's overdue teach-it commitments) — generic across any
   * future exercise with a row that needs the user's attention, not specific to what makes it so. */
  readonly warning?: boolean;
}

export type ExerciseListSort = 'title' | 'status';

/** Search and sort only earn their keep once there's enough to search/sort through (#186); below
 * this the list starts directly with the rows. */
export const LIST_TOOLS_MIN_ITEMS = 6;

/** Case-insensitive substring match on `title` and `subtitle`. */
export function filterExerciseItems<T extends ExerciseListItem>(
  items: readonly T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...items];
  }
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(normalized) ||
      (item.subtitle?.toLowerCase().includes(normalized) ?? false),
  );
}

/** `'title'`: alphabetical. `'status'`: not-done first, then alphabetical within each group. */
export function sortExerciseItems<T extends ExerciseListItem>(
  items: readonly T[],
  sort: ExerciseListSort,
): T[] {
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'title') {
    return sorted;
  }
  return sorted.sort((a, b) => Number(a.done ?? false) - Number(b.done ?? false));
}
