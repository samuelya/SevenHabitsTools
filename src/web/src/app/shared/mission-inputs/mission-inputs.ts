import { Signal } from '@angular/core';
import { storeSignalFactory } from '../exercise-kit/store-signal-factory';

/**
 * The mission inputs registry (contract in issue #61, created by #58): what Your mission offers
 * as suggestions, read from the exercises that feed it without importing their folders (playbook
 * §6). Each feeder registers one entry from its own `.model.ts`, at module load, so this file is
 * in the initial bundle: types and registrations only, no component or service imports.
 */
export type MissionInputKind = 'values' | 'principles' | 'inspiration';

/** One suggestion: `text` is what the mission copies when the user takes it. */
export interface MissionInputItem {
  readonly id: string;
  readonly text: string;
  readonly detail?: string;
  readonly tags?: readonly string[];
  readonly favourite?: boolean;
}

export interface MissionInputEntry {
  /** Labels the source in the builder (`habits.exercises.<sourceExerciseId>.shortTitle`). */
  readonly sourceExerciseId: string;
  readonly kind: MissionInputKind;
  /** Called in an injection context, like `ExerciseRegistryEntry.statusFactory`. */
  readonly read: () => Signal<readonly MissionInputItem[]>;
}

const registrations: MissionInputEntry[] = [];

/** Adds `entry`, a no-op if its source already registered this kind: unit tests run with Vitest
 * `isolate: false`, so a `.model.ts` can be evaluated against an already-filled registry. */
export function registerMissionInput(entry: MissionInputEntry): void {
  const exists = registrations.some(
    (existing) =>
      existing.sourceExerciseId === entry.sourceExerciseId && existing.kind === entry.kind,
  );
  if (!exists) {
    registrations.push(entry);
  }
}

/** The entries of `kind`, in registration order. */
export function getMissionInputs(kind: MissionInputKind): readonly MissionInputEntry[] {
  return registrations.filter((entry) => entry.kind === kind);
}

/** Builds a `MissionInputEntry.read` from a pure `pick(value)` over a model's `featureStore`
 * slice (`storeSignalFactory()`): a model the registry doesn't hold reads as no items. */
export function storeInputFactory<T>(
  key: string,
  pick: (value: T) => readonly MissionInputItem[],
): () => Signal<readonly MissionInputItem[]> {
  return storeSignalFactory<T, readonly MissionInputItem[]>(key, pick, []);
}
