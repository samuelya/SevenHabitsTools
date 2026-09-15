import { buildExportFilename } from './export-filename.utils';

describe('buildExportFilename', () => {
  it('formats the UTC date as sevenhabits-yyyy-mm-dd.json', () => {
    expect(buildExportFilename(new Date('2026-03-05T23:00:00.000Z'))).toBe(
      'sevenhabits-2026-03-05.json',
    );
  });

  it('pads single-digit months and days', () => {
    expect(buildExportFilename(new Date('2026-01-02T00:00:00.000Z'))).toBe(
      'sevenhabits-2026-01-02.json',
    );
  });
});
