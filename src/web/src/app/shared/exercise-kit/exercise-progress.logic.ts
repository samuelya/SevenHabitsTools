import { HabitId } from '../../core/habits/habits';
import { newRecord, touch } from '../../core/data/record';
import { ExerciseCompletion } from './exercise-kit.model';
import { ExerciseRegistryEntry } from './exercise-registry';

/** `done`/`total` exercises a habit has, per its registered `ExerciseRegistryEntry`s. */
export interface HabitExerciseProgress {
  readonly done: number;
  readonly total: number;
}

function completionFor(
  completions: readonly ExerciseCompletion[],
  exerciseId: string,
): ExerciseCompletion | undefined {
  return completions.find((completion) => completion.exerciseId === exerciseId);
}

/** An exercise is done when it has a completion whose `completedAt` is not followed by a later
 * `reopenedAt` — ISO 8601 UTC timestamps sort lexicographically, so a plain string compare is
 * enough. */
export function isExerciseDone(
  completions: readonly ExerciseCompletion[],
  exerciseId: string,
): boolean {
  const completion = completionFor(completions, exerciseId);
  if (!completion) {
    return false;
  }
  return !completion.reopenedAt || completion.completedAt > completion.reopenedAt;
}

/** The `completedAt` of the exercise's current done episode, or `null` if it isn't done. */
export function completedAtFor(
  completions: readonly ExerciseCompletion[],
  exerciseId: string,
): string | null {
  return isExerciseDone(completions, exerciseId)
    ? (completionFor(completions, exerciseId)?.completedAt ?? null)
    : null;
}

/** Marks `exerciseId` done: upserts its `ExerciseCompletion` with a fresh `completedAt`, creating
 * one the first time. */
export function upsertDoneCompletion(
  completions: readonly ExerciseCompletion[],
  exerciseId: string,
  now: Date,
): ExerciseCompletion[] {
  const existing = completionFor(completions, exerciseId);
  const completedAt = now.toISOString();
  if (!existing) {
    return [...completions, newRecord({ exerciseId, completedAt }, now)];
  }
  return completions.map((completion) =>
    completion === existing ? touch({ ...completion, completedAt }, now) : completion,
  );
}

/** Reopens `exerciseId`: stamps `reopenedAt` on its `ExerciseCompletion`. A no-op array copy if it
 * was never marked done. */
export function reopenCompletion(
  completions: readonly ExerciseCompletion[],
  exerciseId: string,
  now: Date,
): ExerciseCompletion[] {
  const existing = completionFor(completions, exerciseId);
  if (!existing) {
    return [...completions];
  }
  const reopenedAt = now.toISOString();
  return completions.map((completion) =>
    completion === existing ? touch({ ...completion, reopenedAt }, now) : completion,
  );
}

/** `done`/`total` for every exercise registered to `habit` (`exercise-registry.ts`). */
export function progressForHabit(
  completions: readonly ExerciseCompletion[],
  registry: readonly ExerciseRegistryEntry[],
  habit: HabitId,
): HabitExerciseProgress {
  const exerciseIds = registry
    .filter((entry) => entry.habit === habit)
    .map((entry) => entry.exerciseId);
  const done = exerciseIds.filter((exerciseId) => isExerciseDone(completions, exerciseId)).length;
  return { done, total: exerciseIds.length };
}
