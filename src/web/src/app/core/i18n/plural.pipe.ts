import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription, filter, merge } from 'rxjs';

/**
 * Plural-correct counts without `transloco-messageformat` (issue #133: that plugin costs initial
 * bundle bytes for every page, not just the ones with a count to render). Picks
 * `<key>.<category>` — `category` is `Intl.PluralRules` (in the active Transloco language)'s
 * `select(count)` — and falls back to `<key>.other` when the specific category isn't defined for
 * this key: `en` only ever needs `one`/`other` (its only two CLDR categories), while `ar` may
 * define all six (`zero`, `one`, `two`, `few`, `many`, `other`). Translations are stored flattened
 * under their dotted key (`TranslocoService.getTranslation()`), so the existence check is a plain
 * property lookup, not a call through `translate()` — that matters because this app's missing-key
 * handler throws (`ThrowingMissingHandler`, #149/#162), and probing for a category that a key
 * simply doesn't define must not be treated as a real missing key.
 *
 * Reactive, unlike a naive impure pipe that only reads `getTranslation()`/`translate()`
 * synchronously: this exercise's scope loads over HTTP and only once something asks for it, so a
 * cold render (a deep link straight to the page) can run `transform()` before it has arrived.
 * Nothing is translated until `isNamespaceLoaded()` says the strings are in, and the load-event
 * subscription re-renders the binding once they are. This is the same cold-load gap the playbook's
 * "Reactive labels" section documents for `translateSignal`/a `computed()` reading `translate()`
 * directly.
 *
 * Not built on `TranslocoPipe` (which handles cold loads the same way) because the CLDR category
 * can only be picked once the translations are loaded: `TranslocoPipe` caches the key it was
 * called with and captures it in the subscription it opens, so it would keep rendering whatever
 * category was resolvable *before* the scope arrived — permanently `other` where `ar` wanted
 * `few`. Its `updateValue()` is not an extension point either.
 */
@Pipe({ name: 'appPlural', standalone: true, pure: false })
export class AppPluralPipe implements PipeTransform, OnDestroy {
  private readonly transloco = inject(TranslocoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private subscription: Subscription | null = null;

  transform(key: string, count: number, params: Record<string, unknown> = {}): string {
    // One subscription per pipe instance (a template binding gets its own instance, reused across
    // change-detection cycles), not per call: every scope load re-renders every `appPlural`
    // binding, not just the one that happened to trigger it.
    //
    // Both streams, not just the load event: a language the user has already visited is cached, so
    // switching back to it fires no `translationLoadSuccess` at all. An `OnPush` component whose
    // inputs didn't change (a counts card whose numbers are the same) would then keep rendering
    // the previous language's strings until something unrelated marked it dirty. `TranslocoPipe`
    // marks for check on every language change for the same reason.
    this.subscription ??= merge(
      this.transloco.langChanges$,
      this.transloco.events$.pipe(filter((event) => event.type === 'translationLoadSuccess')),
    ).subscribe(() => this.cdr.markForCheck());
    return this.resolve(key, count, params);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private resolve(key: string, count: number, params: Record<string, unknown>): string {
    const lang = this.transloco.getActiveLang();
    const category = new Intl.PluralRules(lang).select(count);
    const translation = this.transloco.getTranslation(lang) as Record<string, unknown>;
    if (!isNamespaceLoaded(translation, key)) {
      // Cold load: blank until the `events$` subscription above re-renders this binding. Nothing
      // is translated here, so `ThrowingMissingHandler`'s dev/test throw is never triggered for
      // what is really "not loaded yet".
      return '';
    }
    const candidate = `${key}.${category}`;
    const resolved = Object.prototype.hasOwnProperty.call(translation, candidate)
      ? candidate
      : `${key}.other`;
    // Deliberately *not* wrapped in a try/catch: past this point the strings this key belongs to
    // are loaded, so a key that still isn't there is genuinely missing — a locale whose `.other`
    // fallback was never written, say — and must reach `ThrowingMissingHandler` (#149/#162) and
    // fail the test run, not render blank text forever.
    return this.transloco.translate(resolved, { count, ...params });
  }
}

/**
 * Whether the strings `key` belongs to have arrived. A Transloco scope is merged into the active
 * language's flattened translation object in one go, under its own alias, so the presence of *any*
 * key in `key`'s top-level namespace means this key's translations are loaded and an absent key is
 * a real gap rather than a pending HTTP request. (The one case this can't tell apart is a key
 * whose entire namespace is misspelled — that renders blank instead of throwing; a misspelt
 * *key* inside a real namespace, by far the likelier slip, still throws.)
 */
function isNamespaceLoaded(translation: Record<string, unknown>, key: string): boolean {
  const namespace = `${key.split('.')[0]}.`;
  return Object.keys(translation).some((loaded) => loaded.startsWith(namespace));
}
