import { Numerals } from './language';

/** The Unicode numbering system for an `Intl` locale extension (`-u-nu-<system>`) matching a
 * `settings.numerals` choice. `'latn'` is Western Arabic numerals (0-9); `'arab'` is Eastern
 * Arabic-Indic numerals (٠-٩). */
export function numberingSystemFor(numerals: Numerals): 'latn' | 'arab' {
  return numerals === 'arabic' ? 'arab' : 'latn';
}

/** The `Intl` locale to format with: the active UI language plus the numbering system, e.g.
 * `en-u-nu-arab` for English text with Eastern Arabic-Indic digits. */
export function intlLocaleFor(lang: string, numerals: Numerals): string {
  return `${lang}-u-nu-${numberingSystemFor(numerals)}`;
}
