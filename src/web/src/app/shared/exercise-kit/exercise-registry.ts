import { HabitId } from '../../core/habits/habits';

/**
 * One exercise contributed to the kit by a feature's own `<feature>.model.ts` (issue #30's data
 * model) — the open/closed extension point `ExerciseProgress.progressFor()` reads to know a
 * habit's total exercise count, mirroring how `FEATURE_ROUTES` (`core/routing/feature-route.ts`)
 * is the routing equivalent. A feature typically registers both: this entry for progress
 * counting, and a `FEATURE_ROUTES` `hub` entry (same `titleKey`) for the habit hub page link.
 */
export interface ExerciseRegistryEntry {
  readonly exerciseId: string;
  readonly habit: HabitId;
  readonly titleKey: string;
  readonly route: string;
}

const registrations = new Map<string, ExerciseRegistryEntry>();

/** Registers an exercise. Throws if `exerciseId` was already registered. */
export function registerExercise(entry: ExerciseRegistryEntry): void {
  if (registrations.has(entry.exerciseId)) {
    throw new Error(`Exercise "${entry.exerciseId}" is already registered`);
  }
  registrations.set(entry.exerciseId, entry);
}

/** The registered exercises, in registration order. */
export function getRegisteredExercises(): readonly ExerciseRegistryEntry[] {
  return [...registrations.values()];
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
