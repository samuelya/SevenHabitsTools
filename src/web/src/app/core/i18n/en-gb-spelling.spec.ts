import { TEST_TRANSLATIONS } from '../../testing/transloco-testing';
import { translationStrings, usSpellingsIn } from './en-gb-spelling.logic';

describe('usSpellingsIn', () => {
  it('finds the en-US variants from the fixed list', () => {
    expect(usSpellingsIn('You recognized the behavior and used your judgment.')).toEqual([
      'recognized',
      'behavior',
      'judgment',
    ]);
    expect(usSpellingsIn('Practicing to prioritize a gray area.')).toEqual([
      'prioritize',
      'gray',
      'Practicing',
    ]);
  });

  it('accepts the en-GB spellings', () => {
    expect(
      usSpellingsIn(
        'You recognised the behaviour, used your judgement, practised, fulfilling a laboratory centre.',
      ),
    ).toEqual([]);
  });

  it('leaves "Synergize", the book\'s own term, alone', () => {
    expect(usSpellingsIn('6 · Synergize')).toEqual([]);
  });
});

describe('translationStrings', () => {
  it('flattens nested values with their key paths, skipping non-strings', () => {
    expect(translationStrings({ a: 'x', b: { c: 'y', d: ['z'] }, e: 1 })).toEqual([
      { key: 'a', text: 'x' },
      { key: 'b.c', text: 'y' },
      { key: 'b.d.0', text: 'z' },
    ]);
  });
});

describe('en translation files (#218: en-GB)', () => {
  const english = Object.entries(TEST_TRANSLATIONS).filter(
    ([name]) => name === 'en' || name.endsWith('/en'),
  );

  it('covers every English file', () => {
    expect(english.length).toBeGreaterThan(1);
  });

  it.each(english)('%s uses no en-US spellings', (_name, translation) => {
    const offenders = translationStrings(translation)
      .map(({ key, text }) => ({ key, found: usSpellingsIn(text) }))
      .filter(({ found }) => found.length > 0);
    expect(offenders).toEqual([]);
  });
});
