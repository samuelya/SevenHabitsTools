import { Injector, Signal, computed, runInInjectionContext, signal } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { getRegisteredModels } from '../../core/data/registry';
import type { ExerciseRegistryEntry } from './exercise-registry';

/**
 * Builds an `ExerciseRegistryEntry.isStarted` factory (issue #216) from an exercise's own pure
 * `isStarted(value)` predicate over its `featureStore` slice. The factory runs later, lazily,
 * through `runInInjectionContext()` (`exerciseStartedSignal()` below), so it may `inject()` —
 * registration itself happens at module load, where there is no injector yet.
 *
 * Defensive, not just lazy: a spec that reset the model registry without re-registering this
 * model would otherwise make `featureStore()` throw during change detection; it reads as "not
 * started" instead (same guard as `teach.model.ts`'s `statusFactory`, review finding on #52).
 */
export function storeStartedFactory<T>(
  modelKey: string,
  isStarted: (value: T) => boolean,
): () => Signal<boolean> {
  return () => {
    if (!getRegisteredModels().some((model) => model.key === modelKey)) {
      return signal(false);
    }
    const store = featureStore<T>(modelKey);
    return computed(() => isStarted(store.value()));
  };
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
