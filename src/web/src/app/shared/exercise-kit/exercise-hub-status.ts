import { Injector, Signal, runInInjectionContext, signal } from '@angular/core';
import type { ExerciseHubStatus, ExerciseRegistryEntry } from './exercise-registry';
import { storeSignalFactory } from './store-signal-factory';

/**
 * Builds an `ExerciseRegistryEntry.statusFactory` (issues #52, #219) from an exercise's own pure
 * `hubStatus(value)` over its `featureStore` slice — the status-column twin of
 * `storeStartedFactory()` (`exercise-started.ts`), both built on `storeSignalFactory()`: an
 * unregistered model reads as "no status".
 */
export function storeStatusFactory<T>(
  modelKey: string,
  hubStatus: (value: T) => ExerciseHubStatus | null,
): () => Signal<ExerciseHubStatus | null> {
  return storeSignalFactory<T, ExerciseHubStatus | null>(modelKey, hubStatus, null);
}

/** The one read of `ExerciseRegistryEntry.statusFactory`: calls it in `injector`'s context, and
 * reads an entry that doesn't register one as "no status", so no caller branches on the optional
 * field itself. */
export function exerciseStatusSignal(
  entry: ExerciseRegistryEntry,
  injector: Injector,
): Signal<ExerciseHubStatus | null> {
  return entry.statusFactory ? runInInjectionContext(injector, entry.statusFactory) : signal(null);
}
