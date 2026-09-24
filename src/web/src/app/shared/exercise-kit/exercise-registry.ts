import { Signal } from '@angular/core';
import { HabitId } from '../../core/habits/habits';

/** An extra status line the habit hub page renders under a registered exercise, beyond the done
 * badge every exercise already gets for free (issue #52's "count of shared chapters" on the
 * Paradigms hub) — `key` is a plural-correct key (`AppPluralPipe`) in the `habits` scope, `count`
 * the number it's about. Generic across any future exercise that wants a count-style status; the
 * hub renders it without knowing which exercise supplied it. */
export interface ExerciseHubStatus {
  readonly key: string;
  readonly count: number;
}

/**
 * One exercise contributed to the kit by a feature's own `<feature>.model.ts` (issue #30's data
 * model) — the open/closed extension point both `ExerciseProgress.progressFor()` (a habit's
 * done/total count) and the habit hub page (issue #31, `features/habits/habit-hub-page.ts`) read.
 * A feature also adds its own `FEATURE_ROUTES` entry (`core/routing/feature-route.ts`) so its
 * `route` resolves — the hub page lists exercises from this registry directly, not from
 * `FEATURE_ROUTES`.
 */
export interface ExerciseRegistryEntry {
  readonly exerciseId: string;
  readonly habit: HabitId;
  readonly titleKey: string;
  /** One-line paraphrased summary shown under the title on the habit hub page (issue #31). */
  readonly summaryKey: string;
  readonly icon: string;
  readonly route: string;
  /** Optional extra status line (issue #52). Called once by the hub page through
   * `runInInjectionContext()`, so it may `inject()` (e.g. its own `featureStore`) the same way a
   * component field initializer would. Returns `null` while there's nothing to show. */
  readonly statusFactory?: () => Signal<ExerciseHubStatus | null>;
  /** Whether the user has started this exercise (issue #216), same factory shape and calling
   * convention as `statusFactory`. Absent means "not started": read it through
   * `exerciseStartedSignal()` (`exercise-started.ts`), never directly. Build it with
   * `storeStartedFactory()` from the exercise's own pure `isStarted(value)` predicate. */
  readonly isStarted?: () => Signal<boolean>;
}

const registrations = new Map<string, ExerciseRegistryEntry>();

/** Registers an exercise. Throws if `exerciseId` or `route` was already registered. */
export function registerExercise(entry: ExerciseRegistryEntry): void {
  if (registrations.has(entry.exerciseId)) {
    throw new Error(`Exercise "${entry.exerciseId}" is already registered`);
  }
  for (const existing of registrations.values()) {
    if (existing.route === entry.route) {
      throw new Error(`Route "${entry.route}" is already registered by "${existing.exerciseId}"`);
    }
  }
  registrations.set(entry.exerciseId, entry);
}

/** The registered exercises, in registration order. */
export function getRegisteredExercises(): readonly ExerciseRegistryEntry[] {
  return [...registrations.values()];
}

/** The registered exercises for one habit, in registration order. */
export function exercisesForHabit(
  registry: readonly ExerciseRegistryEntry[],
  habit: HabitId,
): readonly ExerciseRegistryEntry[] {
  return registry.filter((entry) => entry.habit === habit);
}

/** Test-only: see `snapshotRegistryForTesting()` in `core/data/registry.ts` — same purpose, for
 * this separate registry. */
export function snapshotExerciseRegistryForTesting(): ReadonlyMap<string, ExerciseRegistryEntry> {
  return new Map(registrations);
}

/** Test-only: clears the registry, then restores `snapshot` if given. */
export function resetExerciseRegistryForTesting(
  snapshot?: ReadonlyMap<string, ExerciseRegistryEntry>,
): void {
  registrations.clear();
  if (snapshot) {
    for (const [exerciseId, entry] of snapshot) {
      registrations.set(exerciseId, entry);
    }
  }
}
