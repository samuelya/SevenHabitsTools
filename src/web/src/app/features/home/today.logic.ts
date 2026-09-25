import { HabitDefinition } from '../../core/habits/habits';
import { nextExercise } from '../../shared/exercise-kit/exercise-progress.logic';
import {
  ExerciseRegistryEntry,
  exercisesForHabit,
} from '../../shared/exercise-kit/exercise-registry';

/** Today's "Continue" target (issue #220): an exercise and the habit it belongs to. */
export interface TodayContinueTarget {
  readonly habit: HabitDefinition;
  readonly exercise: ExerciseRegistryEntry;
}

/** The hub's continue rule (`nextExercise()`, #219) applied across habits in book order: the first
 * not-done exercise of the first habit that still has one. Habits without exercises are skipped.
 * `undefined` once every registered exercise is done. */
export function todayContinueTarget(
  habits: readonly HabitDefinition[],
  registry: readonly ExerciseRegistryEntry[],
  isDone: (exerciseId: string) => boolean,
): TodayContinueTarget | undefined {
  for (const habit of habits) {
    const exercise = nextExercise(exercisesForHabit(registry, habit.id), isDone);
    if (exercise) {
      return { habit, exercise };
    }
  }
  return undefined;
}

/** A plural status's interpolation params with every number formatted for `locale`, so the
 * numerals setting (`settings.numerals`, #229 F-F2) reaches Today's counters. `count` is included:
 * `appPlural` still picks the plural category from the raw number and lets these params override
 * the `count` it interpolates. */
export function localizedCountParams(
  count: number,
  params: Readonly<Record<string, number>>,
  locale: string,
): Record<string, string> {
  const format = new Intl.NumberFormat(locale);
  return Object.fromEntries(
    Object.entries({ ...params, count }).map(([name, value]) => [name, format.format(value)]),
  );
}
