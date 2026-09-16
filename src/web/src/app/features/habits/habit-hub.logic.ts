import { ExerciseRegistryEntry } from '../../shared/exercise-kit/exercise-registry';

/** The 'Continue' target: the first registered exercise, in book (registration) order, that isn't
 * done yet. `undefined` when every exercise is done, or none are registered for this habit. */
export function nextExerciseRoute(
  exercises: readonly ExerciseRegistryEntry[],
  isDone: (exerciseId: string) => boolean,
): string | undefined {
  return exercises.find((exercise) => !isDone(exercise.exerciseId))?.route;
}
