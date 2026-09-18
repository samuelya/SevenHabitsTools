import { HabitId } from '../../core/habits/habits';

/**
 * A shortcut a feature contributes to every habit hub page (issue #52's "teach this" link) — the
 * open/closed extension point the hub page (`features/habits/habit-hub-page.ts`) renders on every
 * hub, not just the registering feature's own one. Kept separate from `ExerciseRegistryEntry`
 * (`exercise-registry.ts`): that registry is "one exercise, on its own habit's hub", this one is
 * "one action, on every habit's hub".
 */
export interface HubActionEntry {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: string;
  readonly route: string;
  /** Builds the query params for the link on a given habit's hub (e.g. `{ chapter: habit }` so the
   * target page can pre-select that habit). Omit for an action whose target needs no context from
   * the hub it's shown on. */
  readonly queryParams?: (habit: HabitId) => Record<string, string>;
}

const registrations = new Map<string, HubActionEntry>();

/** Registers a hub action. Throws if `id` was already registered. */
export function registerHubAction(entry: HubActionEntry): void {
  if (registrations.has(entry.id)) {
    throw new Error(`Hub action "${entry.id}" is already registered`);
  }
  registrations.set(entry.id, entry);
}

/** The registered hub actions, in registration order. */
export function getRegisteredHubActions(): readonly HubActionEntry[] {
  return [...registrations.values()];
}

/** Test-only: see `snapshotRegistryForTesting()` in `core/data/registry.ts` — same purpose, for
 * this separate registry. */
export function snapshotHubActionRegistryForTesting(): ReadonlyMap<string, HubActionEntry> {
  return new Map(registrations);
}

/** Test-only: clears the registry, then restores `snapshot` if given. */
export function resetHubActionRegistryForTesting(
  snapshot?: ReadonlyMap<string, HubActionEntry>,
): void {
  registrations.clear();
  if (snapshot) {
    for (const [id, entry] of snapshot) {
      registrations.set(id, entry);
    }
  }
}
