import { Signal, computed, signal } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { getRegisteredModels } from '../../core/data/registry';

/**
 * Builds a lazy registry factory from a pure `pick(value)` over a model's `featureStore` slice:
 * the one shape behind `storeStartedFactory()`, `storeStatusFactory()` and `storeInputFactory()`.
 * The factory runs later through `runInInjectionContext()`, so it may `inject()`; registration
 * happens at module load, where there is no injector yet. A model the registry doesn't hold (a
 * spec that reset it without re-registering) reads as `fallback` instead of making
 * `featureStore()` throw during change detection (review finding on #52).
 */
export function storeSignalFactory<T, R>(
  modelKey: string,
  pick: (value: T) => R,
  fallback: R,
): () => Signal<R> {
  return () => {
    if (!getRegisteredModels().some((model) => model.key === modelKey)) {
      return signal(fallback);
    }
    const store = featureStore<T>(modelKey);
    return computed(() => pick(store.value()));
  };
}
