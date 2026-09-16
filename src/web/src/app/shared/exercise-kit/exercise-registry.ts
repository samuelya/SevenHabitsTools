import { HabitId } from '../../core/habits/habits';

/**
 * One exercise contributed to the kit by a feature's own `<feature>.model.ts` (issue #30's data
 * model) — the open/closed extension point both `ExerciseProgress.progressFor()` (a habit's
 * done/total count) and the habit hub page (issue #31, `features/habits/habit-hub-page.ts`) read.
 * A feature also adds its own `FEATURE_ROUTES` entry (`core/routing/feature-route.ts`) so its
 * `route` resolves, but does not need a `hub` entry there — the hub page lists exercises from this
 * registry directly, not from `FEATURE_ROUTES`.
 */
export interface ExerciseRegistryEntry {
  readonly exerciseId: string;
  readonly habit: HabitId;
  readonly titleKey: string;
  /** One-line paraphrased summary shown under the title on the habit hub page (issue #31). */
  readonly summaryKey: string;
  readonly icon: string;
  readonly route: string;
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
