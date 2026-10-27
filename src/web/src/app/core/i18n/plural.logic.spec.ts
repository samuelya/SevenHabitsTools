import { PluralTranslator, translatePlural } from './plural.logic';

/** A flattened translation table the way `TranslocoService` stores it, `translate()` throwing on
 * a missing key like `ThrowingMissingHandler`. */
function translator(lang: string, translations: Record<string, string>): PluralTranslator {
  return {
    getActiveLang: () => lang,
    getTranslation: () => translations,
    translate: (key: string, params: Record<string, unknown>) => {
      const value = translations[key];
      if (value === undefined) {
        throw new Error(`Missing key "${key}"`);
      }
      return value.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name]));
    },
  };
}

const EN = { 'goals.count.one': '1 goal', 'goals.count.other': '{{count}} goals' };
const AR = {
  'goals.count.one': 'هدف واحد',
  'goals.count.two': 'هدفان',
  'goals.count.few': '{{count}} أهداف',
  'goals.count.many': '{{count}} هدفًا',
  'goals.count.other': '{{count}} هدف',
};

describe('translatePlural', () => {
  it('picks the CLDR form for the count and falls back to "other"', () => {
    expect(translatePlural(translator('en', EN), 'goals.count', 1, 'western')).toBe('1 goal');
    expect(translatePlural(translator('en', EN), 'goals.count', 2, 'western')).toBe('2 goals');
    expect(translatePlural(translator('ar', AR), 'goals.count', 2, 'western')).toBe('هدفان');
    expect(translatePlural(translator('ar', AR), 'goals.count', 3, 'western')).toBe('3 أهداف');
    expect(translatePlural(translator('ar', AR), 'goals.count', 11, 'western')).toBe('11 هدفًا');
    expect(translatePlural(translator('ar', AR), 'goals.count', 100, 'western')).toBe('100 هدف');
  });

  it('takes the category from the number and the shown count from params', () => {
    expect(
      translatePlural(translator('ar', AR), 'goals.count', 11, 'western', {
        count: '١١',
      }),
    ).toBe('١١ هدفًا');
  });

  it.each([
    [0, '٠ هدف'],
    [1, 'هدف واحد'],
    [2, 'هدفان'],
    [3, '٣ أهداف'],
    [11, '١١ هدفًا'],
    [100, '١٠٠ هدف'],
  ])(
    'shows ar count %i in Arabic-Indic numerals, category from the number (#305)',
    (count, text) => {
      // `ar` 0 is CLDR "zero", which this key leaves to "other" (as most of the app's keys do).
      expect(translatePlural(translator('ar', AR), 'goals.count', count, 'arabic')).toBe(text);
    },
  );

  it('keeps Western numerals in ar when that is the setting', () => {
    expect(translatePlural(translator('ar', AR), 'goals.count', 11, 'western')).toBe('11 هدفًا');
    expect(translatePlural(translator('ar', AR), 'goals.count', 100, 'western')).toBe('100 هدف');
  });

  it('formats numeric params too and passes text params through unformatted', () => {
    const table = { 'goals.count.other': '{{count}} of {{total}} in {{role}}' };
    expect(
      translatePlural(translator('en', table), 'goals.count', 2, 'arabic', {
        total: 12,
        role: 'Work 7',
      }),
    ).toBe('٢ of ١٢ in Work 7');
  });

  it("is blank until the key's namespace has loaded, then throws on a real gap", () => {
    expect(translatePlural(translator('en', {}), 'goals.count', 2, 'western')).toBe('');
    expect(() =>
      translatePlural(translator('en', { 'goals.other': 'x' }), 'goals.count', 2, 'western'),
    ).toThrowError(/Missing key/);
  });
});
