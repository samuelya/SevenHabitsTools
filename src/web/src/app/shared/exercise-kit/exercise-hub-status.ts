import {
  Injector,
  Signal,
  computed,
  inject,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, combineLatest, map, of, switchMap } from 'rxjs';
import type {
  ExerciseHubStatus,
  ExerciseRegistryEntry,
  HubStatusKeyParam,
  HubStatusText,
} from './exercise-registry';
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
 * field itself. Its `keyParams` come back translated (`translatedHubStatus()`). Built `untracked`:
 * the hub and Today create these lazily from a template or a `computed`, and the translation's
 * `toObservable` effect must not be created inside that reactive context (NG0602). */
export function exerciseStatusSignal(
  entry: ExerciseRegistryEntry,
  injector: Injector,
): Signal<HubStatusText | null> {
  const factory = entry.statusFactory;
  return factory
    ? untracked(() => runInInjectionContext(injector, () => translatedHubStatus(factory())))
    : signal(null);
}

type KeyParams = Readonly<Record<string, HubStatusKeyParam>>;

/**
 * `status` with each `keyParams` entry translated in the active language (its scope loaded on
 * demand) and merged into `params`. A status without `keyParams` passes through as it is; one with
 * them reads `null` until their translations arrive, so the hub never shows a blank or a previous
 * status's name. Call in an injection context.
 */
export function translatedHubStatus(
  status: Signal<ExerciseHubStatus | null>,
): Signal<HubStatusText | null> {
  const injector = inject(Injector);
  const refs = computed(() => status()?.keyParams ?? null, { equal: sameKeyParams });
  const translated = toSignal(
    toObservable(refs).pipe(
      switchMap((current) =>
        current === null
          ? of(null)
          : translateKeyParams(injector.get(TranslocoService), current).pipe(
              map((values) => ({ refs: current, values })),
            ),
      ),
    ),
    { initialValue: null },
  );
  return computed(() => {
    const current = status();
    if (current === null) {
      return null;
    }
    const { keyParams, ...text } = current;
    if (keyParams === undefined) {
      return text;
    }
    const resolved = translated();
    return resolved !== null && resolved.refs === refs()
      ? { ...text, params: { ...text.params, ...resolved.values } }
      : null;
  });
}

/** Every param's translation, re-emitted on a language change. */
function translateKeyParams(
  transloco: TranslocoService,
  refs: KeyParams,
): Observable<Record<string, string>> {
  const entries = Object.entries(refs);
  if (entries.length === 0) {
    return of({});
  }
  return combineLatest(
    entries.map(([, ref]) => transloco.selectTranslate<string>(ref.key, {}, ref.scope)),
  ).pipe(map((texts) => Object.fromEntries(entries.map(([name], index) => [name, texts[index]]))));
}

function sameKeyParams(a: KeyParams | null, b: KeyParams | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  const names = Object.keys(a);
  return (
    names.length === Object.keys(b).length &&
    names.every((name) => a[name].scope === b[name]?.scope && a[name].key === b[name]?.key)
  );
}
