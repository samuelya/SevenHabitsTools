import { Labels } from './labels';

describe('Labels', () => {
  it('returns the label for a known key', () => {
    expect(new Labels().text('nav.home')).toBe('Home');
  });

  it('returns the key itself when it is unknown', () => {
    expect(new Labels().text('nope.unknown')).toBe('nope.unknown');
  });

  it('fills in {name} placeholders from params', () => {
    expect(new Labels().text('settings.backup.exportedSnackbar', { filename: 'a.json' })).toBe(
      'Exported a.json.',
    );
  });

  it('leaves an unmatched placeholder alone', () => {
    expect(new Labels().text('settings.backup.exportedSnackbar', {})).toBe('Exported {filename}.');
  });
});
