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
