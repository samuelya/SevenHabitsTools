import { Signal } from '@angular/core';
import { HabitId } from '../../core/habits/habits';

/** An exercise's in-progress text in the habit hub's status column (issues #52, #219: "2 of 3
 * steps", "3 patterns") — `key` is a plural-correct key (`AppPluralPipe`) in the `habits` scope,
 * `count` the number it's about. Generic across every exercise; the hub renders it without knowing
 * which exercise supplied it. */
export interface ExerciseHubStatus {
  readonly key: string;
  readonly count: number;
  /** Extra interpolation params for `key` beyond `count` (e.g. `{ total: 3 }` for "2 of 3
   * steps", issue #219). */
  readonly params?: Readonly<Record<string, number>>;
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
  /** The long, teaching title (`habits` scope): the exercise page's `h1`, never chrome. */
  readonly titleKey: string;
  /** The ≤ 3-word title (`habits` scope) every piece of chrome renders — the hub list and its
   * "Continue" button (issue #218). The route's toolbar/tab title is the root-scope
   * `titles.<exerciseId>`, holding the same short wording. */
  readonly shortTitleKey: string;
  readonly icon: string;
  readonly route: string;
  /** Chapter order on the habit hub (issue #219): lower first. Optional; an entry without one sorts
   * after every ordered entry, in registration order (`sortByOrder()`). Leave gaps (10, 20, ...) so
   * a later exercise can slot in between without renumbering. */
  readonly order?: number;
  /** Optional in-progress text for the hub's status column (issues #52, #219): build it with
   * `storeStatusFactory()` (`exercise-hub-status.ts`). Called once by the hub page through
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

/** `entries` in chapter order (issue #219): by `order`, a missing one counting as last; ties and
 * unordered entries keep their given (registration) order, since `Array.prototype.sort` is stable. */
export function sortByOrder(
  entries: readonly ExerciseRegistryEntry[],
): readonly ExerciseRegistryEntry[] {
  const orderOf = (entry: ExerciseRegistryEntry): number => entry.order ?? Number.POSITIVE_INFINITY;
  return [...entries].sort((a, b) => {
    const difference = orderOf(a) - orderOf(b);
    return Number.isNaN(difference) ? 0 : difference;
  });
}

/** The registered exercises for one habit, in chapter order (`sortByOrder()`). */
export function exercisesForHabit(
  registry: readonly ExerciseRegistryEntry[],
  habit: HabitId,
): readonly ExerciseRegistryEntry[] {
  return sortByOrder(registry.filter((entry) => entry.habit === habit));
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
