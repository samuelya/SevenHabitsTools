import { Injector, Signal, computed, runInInjectionContext, signal } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { getRegisteredModels } from '../../core/data/registry';
import type { ExerciseHubStatus, ExerciseRegistryEntry } from './exercise-registry';

/**
 * Builds an `ExerciseRegistryEntry.statusFactory` (issues #52, #219) from an exercise's own pure
 * `hubStatus(value)` over its `featureStore` slice — the status-column twin of
 * `storeStartedFactory()` (`exercise-started.ts`), with the same lazy calling convention and the
 * same guard: a spec that reset the model registry without re-registering this model reads as "no
 * status" instead of throwing during change detection.
 */
export function storeStatusFactory<T>(
  modelKey: string,
  hubStatus: (value: T) => ExerciseHubStatus | null,
): () => Signal<ExerciseHubStatus | null> {
  return () => {
    if (!getRegisteredModels().some((model) => model.key === modelKey)) {
      return signal(null);
    }
    const store = featureStore<T>(modelKey);
    return computed(() => hubStatus(store.value()));
  };
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
