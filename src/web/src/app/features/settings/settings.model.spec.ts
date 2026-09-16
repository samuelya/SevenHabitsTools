import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { defaultLanguage, defaultNumerals } from './settings.model';

describe('settings model', () => {
  it('registers "settings.language" and "settings.numerals" as independent leaves', () => {
    const models = getRegisteredModels();
    expect(models.find((model) => model.key === 'language')?.path).toBe('settings.language');
    expect(models.find((model) => model.key === 'numerals')?.path).toBe('settings.numerals');
  });

  it('defaults to following the browser language and Western numerals', () => {
    expect(defaultLanguage()).toBeNull();
    expect(defaultNumerals()).toBe('western');
  });

  it('wires validation through to validateDocument()', () => {
    expect(validateDocument({ settings: { language: 'ar', numerals: 'arabic' } })).toEqual([]);
    expect(validateDocument({ settings: { language: 'fr' } })).not.toEqual([]);
  });

  it('accepts an empty or partial slice — a missing field falls back to its default on read', () => {
    expect(validateDocument({ settings: {} })).toEqual([]);
    expect(validateDocument({ settings: { language: 'en' } })).toEqual([]);
    expect(validateDocument({ settings: { numerals: 'western' } })).toEqual([]);
    expect(validateDocument({})).toEqual([]);
  });

  it('rejects a present field with the wrong value', () => {
    expect(validateDocument({ settings: { language: 'fr' } })).not.toEqual([]);
    expect(validateDocument({ settings: { numerals: 'roman' } })).not.toEqual([]);
  });
});
