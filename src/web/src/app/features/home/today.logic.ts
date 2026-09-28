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
