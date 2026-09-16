import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../data/feature-store';
import { Numerals } from './language';
import { intlLocaleFor } from './locale.logic';

/**
 * `Intl`-backed date formatting for the active language and the user's numerals preference
 * (`settings.numerals`), the `translocoDate`-style pipe issue #28 asks for. Impure: the active
 * language and numerals can change at runtime (the language switcher) and neither is a template
 * input the pipe could otherwise depend on for memoization.
 */
@Pipe({ name: 'appDate', standalone: true, pure: false })
export class AppDatePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly numerals = featureStore<Numerals>('numerals');

  transform(
    value: string | number | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  ): string {
    const date = toDate(value);
    if (!date) {
      return '';
    }
    const locale = intlLocaleFor(this.transloco.getActiveLang(), this.numerals.value());
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
}

/** `Intl`-backed number formatting, same locale/numerals rule as `AppDatePipe`. */
@Pipe({ name: 'appNumber', standalone: true, pure: false })
export class AppNumberPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly numerals = featureStore<Numerals>('numerals');

  transform(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '';
    }
    const locale = intlLocaleFor(this.transloco.getActiveLang(), this.numerals.value());
    return new Intl.NumberFormat(locale, options).format(value);
  }
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
