import { Signal, computed, inject } from '@angular/core';
import { DocumentStore, PathUpdater } from './document.store';
import { getRegisteredModels } from './registry';

/** A feature's narrow read/write view of its own slice of the document — never the whole
 * `DocumentStore` (interface segregation). */
export interface FeatureStore<T> {
  /** The slice's current value, falling back to the model's `defaults()` while it is unset. */
  readonly value: Signal<T>;
  update(updater: PathUpdater<T>): void;
}

/**
 * Typed facade over the slice a feature registered with `registerModel({ key, ... })`
 * (`registry.ts`). Call it from a feature's own service or component field initializer — it calls
 * `inject()`, so it needs an injection context. Features resolve their own slice by `key` instead
 * of knowing the document's `path`, so nobody but the model registration needs to change if a
 * feature's storage path ever moves.
 */
export function featureStore<T>(key: string): FeatureStore<T> {
  const registration = getRegisteredModels().find((model) => model.key === key);
  if (!registration) {
    throw new Error(`No model registered for key "${key}"`);
  }
  const path = registration.path;
  const defaults = registration.defaults as () => T;
  const store = inject(DocumentStore);
  const slice = store.select<T>(path);

  return {
    value: computed(() => slice() ?? defaults()),
    update: (updater) => store.update<T>(path, (current) => updater(current ?? defaults())),
  };
}
