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
    expect(translatePlural(translator('en', EN), 'goals.count', 1)).toBe('1 goal');
    expect(translatePlural(translator('en', EN), 'goals.count', 2)).toBe('2 goals');
    expect(translatePlural(translator('ar', AR), 'goals.count', 2)).toBe('هدفان');
    expect(translatePlural(translator('ar', AR), 'goals.count', 3)).toBe('3 أهداف');
    expect(translatePlural(translator('ar', AR), 'goals.count', 11)).toBe('11 هدفًا');
    expect(translatePlural(translator('ar', AR), 'goals.count', 100)).toBe('100 هدف');
  });

  it('takes the category from the number and the shown count from params', () => {
    expect(translatePlural(translator('ar', AR), 'goals.count', 11, { count: '١١' })).toBe(
      '١١ هدفًا',
    );
  });

  it("is blank until the key's namespace has loaded, then throws on a real gap", () => {
    expect(translatePlural(translator('en', {}), 'goals.count', 2)).toBe('');
    expect(() =>
      translatePlural(translator('en', { 'goals.other': 'x' }), 'goals.count', 2),
    ).toThrowError(/Missing key/);
  });
});
