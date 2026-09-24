import { HabitId } from '../../core/habits/habits';
import { newRecord, touch } from '../../core/data/record';
import { ExerciseCompletion } from './exercise-kit.model';
import { ExerciseRegistryEntry, exercisesForHabit, sortByOrder } from './exercise-registry';

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

/** An exercise is done when it has a completion that hasn't since been reopened.
 * `upsertDoneCompletion` clears `reopenedAt` and `reopenCompletion` sets it, so whichever ran last
 * decides — no timestamp comparison needed, which would otherwise be ambiguous when two calls
 * land in the same millisecond (a fixed/mocked clock in tests, or two real calls that fast). */
export function isExerciseDone(
  completions: readonly ExerciseCompletion[],
  exerciseId: string,
): boolean {
  const completion = completionFor(completions, exerciseId);
  return !!completion && !completion.reopenedAt;
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
 * one the first time. Clears any prior `reopenedAt` — this "done" event always supersedes an
 * earlier reopen, however close together the two happened. */
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
    completion === existing
      ? touch({ ...completion, completedAt, reopenedAt: undefined }, now)
      : completion,
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

/** Whether any exercise has ever been marked done (issue #220's first-run check): a completion
 * record exists, even one reopened since. Tombstoned records don't count. */
export function hasAnyCompletion(completions: readonly ExerciseCompletion[]): boolean {
  return completions.some((completion) => !completion.deletedAt);
}

/** `done`/`total` for every exercise registered to `habit` (`exercise-registry.ts`). */
export function progressForHabit(
  completions: readonly ExerciseCompletion[],
  registry: readonly ExerciseRegistryEntry[],
  habit: HabitId,
): HabitExerciseProgress {
  const exerciseIds = exercisesForHabit(registry, habit).map((entry) => entry.exerciseId);
  const done = exerciseIds.filter((exerciseId) => isExerciseDone(completions, exerciseId)).length;
  return { done, total: exerciseIds.length };
}

/** The "Continue" target (issue #219, for the habit hub and later Today): the first exercise in
 * chapter order (`sortByOrder()`) that isn't done yet. `undefined` when every exercise is done, or
 * none are given. Sorts itself, so a caller can't pass registration order by mistake. */
export function nextExercise(
  exercises: readonly ExerciseRegistryEntry[],
  isDone: (exerciseId: string) => boolean,
): ExerciseRegistryEntry | undefined {
  return sortByOrder(exercises).find((exercise) => !isDone(exercise.exerciseId));
}
