import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { defaultSettings, isSettingsData } from './settings.model';

describe('settings model', () => {
  it('registers "settings" at the document root', () => {
    const registration = getRegisteredModels().find((model) => model.key === 'settings');
    expect(registration?.path).toBe('settings');
  });

  it('defaults to following the browser language and Western numerals', () => {
    expect(defaultSettings()).toEqual({ language: null, numerals: 'western' });
  });

  it('wires validation through to validateDocument()', () => {
    expect(validateDocument({ settings: { language: 'ar', numerals: 'arabic' } })).toEqual([]);
    expect(validateDocument({ settings: { language: 'fr' } })).not.toEqual([]);
  });
});

describe('isSettingsData', () => {
  it('accepts a settings slice with both fields set', () => {
    expect(isSettingsData({ language: 'ar', numerals: 'arabic' })).toBe(true);
  });

  it('accepts an empty or partial slice — missing fields fall back to defaults on read', () => {
    expect(isSettingsData({})).toBe(true);
    expect(isSettingsData({ language: 'en' })).toBe(true);
    expect(isSettingsData({ numerals: 'western' })).toBe(true);
  });

  it('rejects a present field with the wrong value, or a non-object', () => {
    expect(isSettingsData({ language: 'fr' })).toBe(false);
    expect(isSettingsData({ numerals: 'roman' })).toBe(false);
    expect(isSettingsData('nope')).toBe(false);
    expect(isSettingsData(null)).toBe(false);
  });
});
