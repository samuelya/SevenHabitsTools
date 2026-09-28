import { Numerals } from './language';
import { intlLocaleFor } from './locale.logic';

/** What `translatePlural()` reads from Transloco (`TranslocoService` fits it). */
export interface PluralTranslator {
  getActiveLang(): string;
  getTranslation(lang: string): object;
  translate(key: string, params: Record<string, unknown>): string;
}

/**
 * Plural-correct text for `count`, shared by `AppPluralPipe` and any page that builds a label in a
 * `computed()` (issue #291's goal count). Picks `<key>.<category>`, where `category` is
 * `Intl.PluralRules` (in the active Transloco language)'s `select(count)`, and falls back to
 * `<key>.other` when this key doesn't define that category: `en` only ever needs `one`/`other`,
 * while `ar` may define all six. The category always comes from the raw number; what the string
 * shows is formatted with `numerals` (#305), like `appNumber`: `count` and every numeric param go
 * through `Intl.NumberFormat`, so "١١ هدفًا" never mixes digit systems with the rest of the page.
 * A string param (a translated label, or a value the caller already formatted) passes through
 * unchanged, so nothing is formatted twice; a `count` in `params` overrides the interpolated one.
 *
 * Translations are stored flattened under their dotted key (`getTranslation()`), so the existence
 * check is a plain property lookup, not a call through `translate()`: this app's missing-key
 * handler throws (`ThrowingMissingHandler`, #149/#162), and probing for a category a key simply
 * doesn't define must not be treated as a real missing key. `''` until the strings `key` belongs
 * to have loaded; the caller re-renders on the load event (the pipe) or a signal of the same scope.
 */
export function translatePlural(
  transloco: PluralTranslator,
  key: string,
  count: number,
  numerals: Numerals,
  params: Record<string, unknown> = {},
): string {
  const lang = transloco.getActiveLang();
  const category = new Intl.PluralRules(lang).select(count);
  const translation = transloco.getTranslation(lang) as Record<string, unknown>;
  if (!isNamespaceLoaded(translation, key)) {
    // Cold load: nothing is translated here, so `ThrowingMissingHandler`'s dev/test throw is never
    // triggered for what is really "not loaded yet".
    return '';
  }
  const candidate = `${key}.${category}`;
  const resolved = Object.prototype.hasOwnProperty.call(translation, candidate)
    ? candidate
    : `${key}.other`;
  // Deliberately *not* wrapped in a try/catch: past this point the strings this key belongs to
  // are loaded, so a key that still isn't there is genuinely missing (a locale whose `.other`
  // fallback was never written, say) and must reach `ThrowingMissingHandler` (#149/#162) and fail
  // the test run, not render blank text forever.
  return transloco.translate(resolved, localizedParams({ count, ...params }, lang, numerals));
}

/** `params` with every number formatted for `lang` and `numerals`; anything else unchanged. */
function localizedParams(
  params: Record<string, unknown>,
  lang: string,
  numerals: Numerals,
): Record<string, unknown> {
  const format = new Intl.NumberFormat(intlLocaleFor(lang, numerals));
  return Object.fromEntries(
    Object.entries(params).map(([name, value]) => [
      name,
      typeof value === 'number' ? format.format(value) : value,
    ]),
  );
}

/**
 * Whether the strings `key` belongs to have arrived. A Transloco scope is merged into the active
 * language's flattened translation object in one go, under its own alias, so the presence of *any*
 * key in `key`'s top-level namespace means this key's translations are loaded and an absent key is
 * a real gap rather than a pending HTTP request. (The one case this can't tell apart is a key
 * whose entire namespace is misspelled: that renders blank instead of throwing; a misspelt *key*
 * inside a real namespace, by far the likelier slip, still throws.)
 */
function isNamespaceLoaded(translation: Record<string, unknown>, key: string): boolean {
  const namespace = `${key.split('.')[0]}.`;
  return Object.keys(translation).some((loaded) => loaded.startsWith(namespace));
}
