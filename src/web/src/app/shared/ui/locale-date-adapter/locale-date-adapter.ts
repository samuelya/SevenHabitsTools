import { Injectable, Provider, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_NATIVE_DATE_FORMATS,
  NativeDateAdapter,
} from '@angular/material/core';
import { TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../../../core/data/feature-store';
import { Numerals } from '../../../core/i18n/language';
import { intlLocaleFor } from '../../../core/i18n/locale.logic';
import { DatePartOrder, datePartOrder, parseLocalDate } from './locale-date.logic';

/**
 * Material's native date adapter, following the app's language and numerals (the same locale
 * `AppDatePipe` formats with) and reading dates typed in that locale's own order
 * (`parseLocalDate()`), so a `mat-datepicker` field works in `ar` as well as `en` (issue #57).
 */
@Injectable()
export class LocaleDateAdapter extends NativeDateAdapter {
  /** `datePartOrder()` of the current locale, worked out once per locale, not per keystroke. */
  private partOrder: DatePartOrder = datePartOrder('en');

  constructor() {
    super();
    const transloco = inject(TranslocoService);
    const lang = toSignal(transloco.langChanges$, { initialValue: transloco.getActiveLang() });
    const numerals = featureStore<Numerals>('numerals');
    const locale = (): string => intlLocaleFor(lang(), numerals.value());
    // Now, so the first render already formats and parses in the app's locale; the effect only
    // follows later changes.
    this.setLocale(locale());
    effect(() => this.setLocale(locale()));
  }

  override setLocale(locale: unknown): void {
    super.setLocale(locale);
    this.partOrder = datePartOrder(String(locale));
  }

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      return value.trim() === '' ? null : (parseLocalDate(value, this.partOrder) ?? this.invalid());
    }
    return super.parse(value, parseFormat);
  }
}

/** Route-level providers for a page with a `mat-datepicker`. */
export function provideLocaleDateAdapter(): Provider[] {
  return [
    { provide: DateAdapter, useClass: LocaleDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ];
}
