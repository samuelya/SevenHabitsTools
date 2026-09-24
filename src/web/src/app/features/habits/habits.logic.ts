import { HabitDefinition, HabitId } from '../../core/habits/habits';

/** 0-100 for a habit's overview progress ring; 0 when there's nothing to divide (`total` 0), never
 * `NaN`. */
export function progressPercentage(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** A habits-list row that is always shown (issue #219): a habit with exercises, or the one habit
 * that comes next. */
export interface HabitListRow {
  readonly habit: HabitDefinition;
  readonly state: 'available' | 'nextUp';
}

/** The habits list in its three states (issue #219): `shown` in book order, and every other habit
 * in `later`, collapsed under one row. */
export interface HabitListLayout {
  readonly shown: readonly HabitListRow[];
  readonly later: readonly HabitDefinition[];
}

/** Splits `habits` (book order) into **available** (has exercises), **next up** (the first habit
 * without exercises after an available one, or the very first habit when none is available yet)
 * and **later** (every remaining habit). */
export function habitListLayout(
  habits: readonly HabitDefinition[],
  hasExercises: (habit: HabitId) => boolean,
): HabitListLayout {
  const anyAvailable = habits.some((habit) => hasExercises(habit.id));
  const shown: HabitListRow[] = [];
  const later: HabitDefinition[] = [];
  let seenAvailable = !anyAvailable;
  let nextUpTaken = false;
  for (const habit of habits) {
    if (hasExercises(habit.id)) {
      shown.push({ habit, state: 'available' });
      seenAvailable = true;
    } else if (seenAvailable && !nextUpTaken) {
      shown.push({ habit, state: 'nextUp' });
      nextUpTaken = true;
    } else {
      later.push(habit);
    }
  }
  return { shown, later };
}

/** The collapsed "later" row's label: `key` in the `habits` scope with its `params`. "Habits 2–7 and
 * Interdependence" when the later habits are exactly a run of numbered habits plus
 * Interdependence (today's case); otherwise a plural-correct count (`plural` true, for
 * `AppPluralPipe`). */
export interface LaterLabel {
  readonly key: string;
  readonly count: number;
  readonly params: Readonly<Record<string, number>>;
  readonly plural: boolean;
}

const NUMBERED_HABIT = /^h(\d)$/;

export function laterLabel(later: readonly HabitId[]): LaterLabel {
  const numbers = later
    .map((id) => NUMBERED_HABIT.exec(id)?.[1])
    .filter((digit): digit is string => digit !== undefined)
    .map(Number);
  const onlyNumberedAndInterdependence =
    later.includes('interdependence') && numbers.length === later.length - 1;
  const isRun =
    numbers.length >= 2 && numbers.every((value, index) => value === numbers[0] + index);
  if (onlyNumberedAndInterdependence && isRun) {
    return {
      key: 'habits.list.laterRange',
      count: later.length,
      params: { from: numbers[0], to: numbers[numbers.length - 1] },
      plural: false,
    };
  }
  return { key: 'habits.list.laterCount', count: later.length, params: {}, plural: true };
}
