import { resolveDefaultLanguage, resolveEffectiveLanguage } from './language.logic';

describe('resolveDefaultLanguage', () => {
  it('defaults to Arabic when the browser locale is Arabic', () => {
    expect(resolveDefaultLanguage('ar')).toBe('ar');
    expect(resolveDefaultLanguage('ar-SA')).toBe('ar');
    expect(resolveDefaultLanguage('AR-EG')).toBe('ar');
  });

  it('defaults to English for every other locale, including none', () => {
    expect(resolveDefaultLanguage('en-US')).toBe('en');
    expect(resolveDefaultLanguage('fr')).toBe('en');
    expect(resolveDefaultLanguage(null)).toBe('en');
  });
});

describe('resolveEffectiveLanguage', () => {
  it('uses the persisted choice when there is one, regardless of the browser locale', () => {
    expect(resolveEffectiveLanguage('en', 'ar-SA')).toBe('en');
    expect(resolveEffectiveLanguage('ar', 'en-US')).toBe('ar');
  });

  it('falls back to the browser default when nothing was chosen', () => {
    expect(resolveEffectiveLanguage(null, 'ar-SA')).toBe('ar');
    expect(resolveEffectiveLanguage(undefined, 'en-US')).toBe('en');
  });
});
