/** Which part of a numeric date comes first, second and third in a locale ("9/28/2026" in `en`,
 * "28/9/2026" in `ar`). */
export type DatePartOrder = readonly ('day' | 'month' | 'year')[];

/** The order `Intl` writes a numeric date in for `locale`. */
export function datePartOrder(locale: string): DatePartOrder {
  const parts = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(2000, 10, 22));
  const order = parts
    .map((part) => part.type)
    .filter((type): type is 'day' | 'month' | 'year' => ['day', 'month', 'year'].includes(type));
  return order.length === 3 ? order : ['month', 'day', 'year'];
}

const BIDI_MARKS = /[؜‎‏]/g;
const EASTERN_DIGIT_ZERO = 0x0660;

/** `text` with bidi marks removed and Arabic-Indic digits (٠-٩) turned into 0-9: what an `ar`
 * date field shows, or what a user types there, in the form `parseLocalDate()` reads. */
export function normalizeDateText(text: string): string {
  return text
    .replace(BIDI_MARKS, '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - EASTERN_DIGIT_ZERO))
    .trim();
}

/**
 * A typed date as local midnight, or `null` when it isn't a real calendar date. Reads ISO
 * `YYYY-MM-DD` and three numbers in the locale's own `order` with any separator; a two-digit year
 * means 20xx. `Date.parse`, which Material's `NativeDateAdapter` uses, reads neither day-first nor
 * Arabic-Indic dates, so an `ar` user could never type one.
 */
export function parseLocalDate(text: string, order: DatePartOrder): Date | null {
  const normalized = normalizeDateText(text);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  const numbers = iso
    ? { year: +iso[1], month: +iso[2], day: +iso[3] }
    : fromOrder(/^(\d{1,4})\D+(\d{1,2})\D+(\d{1,4})$/.exec(normalized), order);
  if (numbers === null) {
    return null;
  }
  const year = numbers.year < 100 ? 2000 + numbers.year : numbers.year;
  const date = new Date(year, numbers.month - 1, numbers.day);
  return date.getFullYear() === year &&
    date.getMonth() === numbers.month - 1 &&
    date.getDate() === numbers.day
    ? date
    : null;
}

function fromOrder(
  match: RegExpExecArray | null,
  order: DatePartOrder,
): { year: number; month: number; day: number } | null {
  if (match === null) {
    return null;
  }
  const values = { day: 0, month: 0, year: 0 };
  order.forEach((part, index) => (values[part] = Number(match[index + 1])));
  return values;
}
