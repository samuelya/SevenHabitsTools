import { registerModel } from '../../core/data/registry';
import { isLanguage, isNumerals, Language, Numerals } from '../../core/i18n/language';

/**
 * `settings.language`/`settings.numerals` (architecture issue #1 §6/§7, issue #28's data model)
 * — two independent leaf registrations, not one `settings`-container model: `settings` is also
 * where `core/pwa/pwa.model.ts` registers `settings.pwa`, and `createEmptyDocument()`'s
 * composition sets each registration's own path independently, in registration order — a
 * container registration for the whole `settings` object would silently overwrite whatever a
 * sibling leaf (like `settings.pwa`) had *just* written, depending on that order. Two leaves,
 * like `pwa.model.ts`'s own, never collide regardless of order (`app.config.spec.ts` guards it).
 *
 * `language: null` means "follow the browser default" (`resolveEffectiveLanguage()`, in
 * `language.logic.ts`) rather than a fixed choice; it only becomes `'en'`/`'ar'` once the user
 * picks one explicitly, so a browser language change keeps following along until they do.
 */
export function defaultLanguage(): Language | null {
  return null;
}

export function defaultNumerals(): Numerals {
  return 'western';
}

registerModel<Language | null>({
  key: 'language',
  path: 'settings.language',
  defaults: defaultLanguage,
  validate: (value) => value === null || isLanguage(value),
});

registerModel<Numerals>({
  key: 'numerals',
  path: 'settings.numerals',
  defaults: defaultNumerals,
  validate: isNumerals,
});
