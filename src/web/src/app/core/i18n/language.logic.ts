import { Language } from './language';

/** The language the app renders when nothing was ever chosen: Arabic when the browser's own
 * language is Arabic, English otherwise. Pure so it is unit-testable without a browser. */
export function resolveDefaultLanguage(browserLocale: string | null): Language {
  return browserLocale?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

/** The language actually rendered: the user's persisted choice if there is one, otherwise the
 * browser default. */
export function resolveEffectiveLanguage(
  chosen: Language | null | undefined,
  browserLocale: string | null,
): Language {
  return chosen ?? resolveDefaultLanguage(browserLocale);
}
