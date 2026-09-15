import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { DocumentStore } from '../data/document.store';
import '../../features/settings/settings.model';
import { AppDatePipe, AppNumberPipe } from './locale.pipe';

function withActiveLang(lang: string) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { getActiveLang: () => lang } }],
  });
}

describe('AppDatePipe', () => {
  it('formats a date for the active language, Western numerals by default', () => {
    withActiveLang('en');
    const pipe = TestBed.runInInjectionContext(() => new AppDatePipe());

    expect(pipe.transform('2026-03-15T00:00:00.000Z', { dateStyle: 'long', timeZone: 'UTC' })).toBe(
      'March 15, 2026',
    );
  });

  it('renders Eastern Arabic-Indic digits when settings.numerals is "arabic"', () => {
    withActiveLang('en');
    TestBed.inject(DocumentStore).update('settings', () => ({
      language: 'en',
      numerals: 'arabic',
    }));
    const pipe = TestBed.runInInjectionContext(() => new AppDatePipe());

    const formatted = pipe.transform('2026-03-15T00:00:00.000Z', {
      dateStyle: 'short',
      timeZone: 'UTC',
    });
    expect(formatted).toMatch(/[٠-٩]/);
  });

  it('returns an empty string for null, undefined or an invalid date', () => {
    withActiveLang('en');
    const pipe = TestBed.runInInjectionContext(() => new AppDatePipe());

    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('not a date')).toBe('');
  });
});

describe('AppNumberPipe', () => {
  it('formats a number for the active language, Western numerals by default', () => {
    withActiveLang('en');
    const pipe = TestBed.runInInjectionContext(() => new AppNumberPipe());

    expect(pipe.transform(1234)).toBe('1,234');
  });

  it('renders Eastern Arabic-Indic digits when settings.numerals is "arabic"', () => {
    withActiveLang('ar');
    TestBed.inject(DocumentStore).update('settings', () => ({
      language: 'ar',
      numerals: 'arabic',
    }));
    const pipe = TestBed.runInInjectionContext(() => new AppNumberPipe());

    expect(pipe.transform(12)).toMatch(/[٠-٩]/);
  });

  it('returns an empty string for null, undefined or NaN', () => {
    withActiveLang('en');
    const pipe = TestBed.runInInjectionContext(() => new AppNumberPipe());

    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(NaN)).toBe('');
  });
});
