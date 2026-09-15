import { registerModel } from '../../core/data/registry';
import { isLanguage, isNumerals, Language, Numerals } from '../../core/i18n/language';

/**
 * The document's `settings` slice (architecture issue #1 §6/§7, issue #28's data model).
 * `language: null` means "follow the browser default" (`resolveEffectiveLanguage()`) rather than
 * a fixed choice; it only becomes `'en'`/`'ar'` once the user picks one explicitly, so a browser
 * language change keeps following along until they do.
 */
export interface SettingsData {
  language: Language | null;
  numerals: Numerals;
}

export function defaultSettings(): SettingsData {
  return { language: null, numerals: 'western' };
}

/**
 * Lenient on purpose: a document written before `numerals` (or before this model existed at all,
 * when `settings` was just `{}`) is still valid, so it is only rejected for a field that is
 * *present* and wrong, never for one that is merely missing — `featureStore()`'s `defaults()`
 * fallback fills those in on read.
 */
export function isSettingsData(value: unknown): value is SettingsData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const language = candidate['language'];
  const numerals = candidate['numerals'];
  return (
    (language === undefined || language === null || isLanguage(language)) &&
    (numerals === undefined || isNumerals(numerals))
  );
}

registerModel<SettingsData>({
  key: 'settings',
  path: 'settings',
  defaults: defaultSettings,
  validate: isSettingsData,
});
