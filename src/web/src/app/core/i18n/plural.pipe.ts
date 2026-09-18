import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';

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
 * cold render (a deep link straight to the page) can run `transform()` before it has arrived —
 * `getTranslation()` then has neither the specific category nor `.other`, and (in dev/test, where
 * `ThrowingMissingHandler.logMissingKey` is on) `translate()` on that missing fallback would throw
 * instead of just rendering blank. This is the same cold-load gap the playbook's "Reactive
 * labels" section documents for `translateSignal`/a `computed()` reading `translate()` directly —
 * `TranslocoPipe` itself closes it by subscribing to load events and calling `markForCheck()`
 * once they arrive; this pipe does the same, generically, rather than re-deriving a
 * `translateSignal`-per-count-key.
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
    this.subscription ??= this.transloco.events$
      .pipe(filter((event) => event.type === 'translationLoadSuccess'))
      .subscribe(() => this.cdr.markForCheck());
    return this.resolve(key, count, params);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private resolve(key: string, count: number, params: Record<string, unknown>): string {
    const lang = this.transloco.getActiveLang();
    const category = new Intl.PluralRules(lang).select(count);
    const translation = this.transloco.getTranslation(lang) as Record<string, unknown>;
    const candidate = `${key}.${category}`;
    const resolved = Object.prototype.hasOwnProperty.call(translation, candidate)
      ? candidate
      : `${key}.other`;
    try {
      return this.transloco.translate(resolved, { count, ...params });
    } catch {
      // Cold load, scope not in yet: blank until the `events$` subscription above re-renders
      // this binding, rather than surfacing `ThrowingMissingHandler`'s dev/test-only throw for
      // what is really "not loaded yet", not a genuinely missing key.
      return '';
    }
  }
}
