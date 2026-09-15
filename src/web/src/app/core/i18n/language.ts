/** The two supported UI languages. English is the default; Arabic renders right-to-left. */
export type Language = 'en' | 'ar';

export const LANGUAGES: readonly Language[] = ['en', 'ar'];

/** How to render digits: Western Arabic numerals (0-9, the default) or Eastern Arabic-Indic
 * numerals (٠-٩), a per-user preference independent of the UI language. */
export type Numerals = 'western' | 'arabic';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isNumerals(value: unknown): value is Numerals {
  return value === 'western' || value === 'arabic';
}

/** `dir` for `<html>` and the CDK `Dir` directive. Only Arabic reads right-to-left. */
export function directionFor(language: Language): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr';
}
