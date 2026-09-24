import { HabitId } from '../../core/habits/habits';

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
