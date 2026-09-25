import { datePartOrder, normalizeDateText, parseLocalDate } from './locale-date.logic';

function iso(date: Date | null): string | null {
  if (date === null) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

describe('locale date parsing (#57)', () => {
  it('reads the part order from Intl', () => {
    expect(datePartOrder('en')).toEqual(['month', 'day', 'year']);
    expect(datePartOrder('ar-u-nu-latn')).toEqual(['day', 'month', 'year']);
    expect(datePartOrder('en-GB')).toEqual(['day', 'month', 'year']);
  });

  it('strips bidi marks and reads Arabic-Indic digits', () => {
    expect(normalizeDateText('‏٢٨/٩/٢٠٢٦‏')).toBe('28/9/2026');
  });

  it('parses a date typed in the locale order, ISO, or as the ar field shows it', () => {
    expect(iso(parseLocalDate('9/28/2026', datePartOrder('en')))).toBe('2026-09-28');
    expect(iso(parseLocalDate('28/9/2026', datePartOrder('ar')))).toBe('2026-09-28');
    expect(iso(parseLocalDate('2026-09-28', datePartOrder('ar')))).toBe('2026-09-28');
    const shown = new Intl.DateTimeFormat('ar-u-nu-arab', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(2026, 8, 28));
    expect(iso(parseLocalDate(shown, datePartOrder('ar-u-nu-arab')))).toBe('2026-09-28');
    expect(iso(parseLocalDate('28/9/26', datePartOrder('ar')))).toBe('2026-09-28');
  });

  it('refuses text that is not a real date', () => {
    expect(parseLocalDate('31/2/2026', datePartOrder('ar'))).toBeNull();
    expect(parseLocalDate('13/13/2026', datePartOrder('en'))).toBeNull();
    expect(parseLocalDate('tomorrow', datePartOrder('en'))).toBeNull();
    expect(parseLocalDate('', datePartOrder('en'))).toBeNull();
  });
});
