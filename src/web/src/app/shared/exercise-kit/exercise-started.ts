import { Injector, Signal, runInInjectionContext, signal } from '@angular/core';
import type { ExerciseRegistryEntry } from './exercise-registry';
import { storeSignalFactory } from './store-signal-factory';

/**
 * Builds an `ExerciseRegistryEntry.isStarted` factory (issue #216) from an exercise's own pure
 * `isStarted(value)` predicate over its `featureStore` slice. The factory runs later, lazily,
 * through `runInInjectionContext()` (`exerciseStartedSignal()` below), so it may `inject()` —
 * registration itself happens at module load, where there is no injector yet.
 * An unregistered model reads as "not started" (`storeSignalFactory()`'s guard).
 */
export function storeStartedFactory<T>(
  modelKey: string,
  isStarted: (value: T) => boolean,
): () => Signal<boolean> {
  return storeSignalFactory(modelKey, isStarted, false);
}

/** The one read of `ExerciseRegistryEntry.isStarted` every consumer (the habit hub's status column,
 * #219) goes through: calls the factory in `injector`'s context, and reads an entry that doesn't
 * register one as "not started", so no caller branches on the optional field itself. */
export function exerciseStartedSignal(
  entry: ExerciseRegistryEntry,
  injector: Injector,
): Signal<boolean> {
  return entry.isStarted ? runInInjectionContext(injector, entry.isStarted) : signal(false);
}
