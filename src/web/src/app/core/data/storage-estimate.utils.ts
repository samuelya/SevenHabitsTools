const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export type ByteUnit = (typeof UNITS)[number];

/** A byte count split into a locale-formattable number and a unit abbreviation. Units
 * (KB/MB/GB/TB) are technical terms, not translated — the same treatment as "GitHub" elsewhere in
 * the app — so only `value` goes through `AppNumberPipe`; `unit` is rendered as a literal. */
export interface ByteSize {
  readonly value: number;
  readonly unit: ByteUnit;
  /** `minimumFractionDigits`/`maximumFractionDigits` to pass to `AppNumberPipe`: whole bytes have
   * none, every other unit keeps one decimal place. */
  readonly fractionDigits: 0 | 1;
}

/** Splits a byte count into a human-readable size (KB/MB/GB/TB) for the Settings storage
 * estimate. Byte counts under 1 KB are shown as whole bytes. */
export function toByteSize(bytes: number): ByteSize {
  if (bytes < 1024) {
    return { value: Math.round(bytes), unit: 'B', fractionDigits: 0 };
  }
  let value = bytes;
  let unitIndex = 0;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < UNITS.length - 1);
  return { value: Math.round(value * 10) / 10, unit: UNITS[unitIndex], fractionDigits: 1 };
}

/** `AppNumberPipe` options that reproduce a `ByteSize`'s fixed decimal-place count. */
export function fractionOptionsFor(size: ByteSize): Intl.NumberFormatOptions {
  return { minimumFractionDigits: size.fractionDigits, maximumFractionDigits: size.fractionDigits };
}

/** Which `settings.storage.usage*` transloco key (and, above 1 KB, formatted params) describes a
 * usage byte count. Collapses anything under 1 KB to the same "less than 1 KB" phrasing rather
 * than a raw, easily-misread byte count (#144); `locale` is an already-resolved `Intl` locale
 * (see `intlLocaleFor`) so this stays a pure function the caller can unit test without Angular. */
export interface UsageMessage {
  readonly key: 'settings.storage.usageUnderOneKb' | 'settings.storage.usageApprox';
  /** Set only for `usageApprox`, whose translation interpolates `{{value}} {{unit}}`. */
  readonly params?: { readonly value: string; readonly unit: ByteUnit };
}

export function usageMessageFor(bytes: number, locale: string): UsageMessage {
  const size = toByteSize(bytes);
  if (size.unit === 'B') {
    return { key: 'settings.storage.usageUnderOneKb' };
  }
  const value = new Intl.NumberFormat(locale, fractionOptionsFor(size)).format(size.value);
  return { key: 'settings.storage.usageApprox', params: { value, unit: size.unit } };
}
