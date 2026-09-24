import { ExerciseRegistryEntry } from '../../shared/exercise-kit/exercise-registry';

/** The 'Continue' target: the first registered exercise, in book (registration) order, that isn't
 * done yet. `undefined` when every exercise is done, or none are registered for this habit. The
 * hub reads both its `route` and its `shortTitleKey` ("Continue: <short title>", #218). */
export function nextExercise(
  exercises: readonly ExerciseRegistryEntry[],
  isDone: (exerciseId: string) => boolean,
): ExerciseRegistryEntry | undefined {
  return exercises.find((exercise) => !isDone(exercise.exerciseId));
}
