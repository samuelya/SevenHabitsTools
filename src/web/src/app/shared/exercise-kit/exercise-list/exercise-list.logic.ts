/** A small label under a row's title (issues #224, #225): already-translated text, e.g. a status
 * ("Overdue") or a category ("Family"). `warning` gives it the error colour; the text itself always
 * carries the meaning, so colour is never the only signal. */
export interface ExerciseListChip {
  readonly label: string;
  readonly warning?: boolean;
}

/** One row `ExerciseList` renders. Generic across every future exercise feature — `title`/
 * `subtitle` are already-translated display text, not keys. */
export interface ExerciseListItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Rendered as small chips under the title and subtitle, in this order (issues #224, #225). */
  readonly chips?: readonly ExerciseListChip[];
  readonly done?: boolean;
  /** Visually highlights the row (issue #52's overdue teach-it commitments) — generic across any
   * future exercise with a row that needs the user's attention, not specific to what makes it so. */
  readonly warning?: boolean;
  /** Opts this one row out of `ExerciseList`'s own `deletable` input (issue #203) — for a list
   * whose rows aren't one-to-one with what a delete removes, e.g. `paradigms-teach`'s fixed
   * chapter rows, only deletable once the user has actually filled one in. Ignored when the list's
   * own `deletable` is `false`; defaults to `true` otherwise, so every existing caller (which never
   * sets this) keeps every row deletable. */
  readonly deletable?: boolean;
}

/** `'none'` (issue #52): the caller's own `items()` order, untouched — for a fixed, meaningfully
 * ordered list (the ten book chapters, in book order) where an alphabetical default would scramble
 * that order. Not offered as a toggle choice (`ExerciseList`'s sort control only ever shows
 * "Title"/"Status"); a caller opts in through `initialSort`, and the user can still switch away
 * from it like any other starting sort. */
export type ExerciseListSort = 'title' | 'status' | 'none';

/** Search and sort only earn their keep once there's enough to search/sort through (#186); below
 * this the list starts directly with the rows. */
export const LIST_TOOLS_MIN_ITEMS = 6;

/** Case-insensitive substring match on `title`, `subtitle` and any chip label. */
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
      (item.subtitle?.toLowerCase().includes(normalized) ?? false) ||
      (item.chips?.some((chip) => chip.label.toLowerCase().includes(normalized)) ?? false),
  );
}

/** `'none'`: the given order, unchanged. `'title'`: alphabetical. `'status'`: not-done first, then
 * alphabetical within each group. */
export function sortExerciseItems<T extends ExerciseListItem>(
  items: readonly T[],
  sort: ExerciseListSort,
): T[] {
  if (sort === 'none') {
    return [...items];
  }
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'title') {
    return sorted;
  }
  return sorted.sort((a, b) => Number(a.done ?? false) - Number(b.done ?? false));
}
