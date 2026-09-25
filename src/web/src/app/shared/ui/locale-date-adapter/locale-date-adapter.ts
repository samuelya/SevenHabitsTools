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
import { datePartOrder, parseLocalDate } from './locale-date.logic';

/**
 * Material's native date adapter, following the app's language and numerals (the same locale
 * `AppDatePipe` formats with) and reading dates typed in that locale's own order
 * (`parseLocalDate()`), so a `mat-datepicker` field works in `ar` as well as `en` (issue #57).
 */
@Injectable()
export class LocaleDateAdapter extends NativeDateAdapter {
  constructor() {
    super();
    const transloco = inject(TranslocoService);
    const lang = toSignal(transloco.langChanges$, { initialValue: transloco.getActiveLang() });
    const numerals = featureStore<Numerals>('numerals');
    effect(() => this.setLocale(intlLocaleFor(lang(), numerals.value())));
  }

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      return value.trim() === ''
        ? null
        : (parseLocalDate(value, datePartOrder(String(this.locale))) ?? this.invalid());
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
