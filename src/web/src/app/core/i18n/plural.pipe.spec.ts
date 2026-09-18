import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { AppPluralPipe } from './plural.pipe';

/** A minimal `TranslocoService` stub: flattened translations keyed like the real service stores
 * them, `translate()` throwing on a genuinely missing key (mirroring `ThrowingMissingHandler` in
 * dev/test — see `resolve()`'s own try/catch), and a mutable `translations` object plus a real
 * `events$` so a test can simulate a scope arriving *after* the pipe's first render. Enough to
 * prove the pipe picks the right category, falls back, and re-renders on load — without
 * depending on any feature's real i18n files (which would make this generic pipe's spec fragile
 * to unrelated wording changes). */
function fakeTransloco(lang: string, translations: Record<string, string>) {
  const events = new Subject<{ type: string }>();
  const langChanges = new Subject<string>();
  let activeLang = lang;
  const service = {
    getActiveLang: () => activeLang,
    setActiveLang: (next: string) => {
      activeLang = next;
      langChanges.next(next);
    },
    langChanges$: langChanges.asObservable(),
    getTranslation: () => translations,
    translate: (key: string, params: Record<string, unknown>) => {
      const value = translations[key];
      if (value === undefined) {
        throw new Error(`Missing key "${key}"`);
      }
      return value.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name]));
    },
    events$: events.asObservable(),
  };
  return { service, events };
}

@Component({
  selector: 'app-plural-host',
  imports: [AppPluralPipe],
  template: `{{ key | appPlural: count : params }}`,
})
class HostComponent {
  key = 'summary.named';
  count = 0;
  params: Record<string, unknown> = {};
}

function setUp(
  lang: string,
  translations: Record<string, string>,
  options: { count?: number; params?: Record<string, unknown> } = {},
) {
  const { service, events } = fakeTransloco(lang, translations);
  TestBed.configureTestingModule({ providers: [{ provide: TranslocoService, useValue: service }] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.count = options.count ?? 0;
  fixture.componentInstance.params = options.params ?? {};
  fixture.detectChanges();
  return { fixture, events, translations, service };
}

describe('AppPluralPipe', () => {
  it.each([
    [0, '0 scripts named'],
    [1, '1 script named'],
    [2, '2 scripts named'],
  ])('picks the "en" category for count %i', (count, expected) => {
    const { fixture } = setUp(
      'en',
      {
        'summary.named.one': '{{count}} script named',
        'summary.named.other': '{{count}} scripts named',
      },
      { count },
    );

    expect(fixture.nativeElement.textContent).toBe(expected);
  });

  it.each([
    [0, 'zero scripts'],
    [1, 'one script'],
    [2, 'two scripts'],
    [3, 'a few scripts'],
    [11, 'many scripts'],
    [100, 'other scripts'],
  ])('picks the "ar" category for count %i', (count, expected) => {
    const { fixture } = setUp(
      'ar',
      {
        'summary.named.zero': 'zero scripts',
        'summary.named.one': 'one script',
        'summary.named.two': 'two scripts',
        'summary.named.few': 'a few scripts',
        'summary.named.many': 'many scripts',
        'summary.named.other': 'other scripts',
      },
      { count },
    );

    expect(fixture.nativeElement.textContent).toBe(expected);
  });

  it('falls back to ".other" when the key defines no category for the count', () => {
    // `ar`'s "few" category (count 3) has no dedicated translation for this key — only "other" is
    // defined, the same shape a key that never bothers with every category can have.
    const { fixture } = setUp('ar', { 'summary.named.other': '{{count}} scripts' }, { count: 3 });

    expect(fixture.nativeElement.textContent).toBe('3 scripts');
  });

  it('passes extra params through alongside count', () => {
    const { fixture } = setUp(
      'en',
      { 'summary.named.other': '{{count}} of {{total}}' },
      { count: 2, params: { total: 5 } },
    );

    expect(fixture.nativeElement.textContent).toBe('2 of 5');
  });

  it('re-renders once the scope finishes loading (cold load, issue #187)', () => {
    // Nothing is translated yet — the scope's HTTP request hasn't resolved. The pipe must render
    // blank rather than ask `translate()` for a key it knows isn't loaded, which would hit
    // `ThrowingMissingHandler` (the stub's throw) for what is only a pending request.
    const { fixture, events, translations } = setUp('en', {});
    expect(fixture.nativeElement.textContent).toBe('');

    // The scope arrives; the pipe's `events$` subscription should mark this view for a recheck.
    translations['summary.named.other'] = '{{count}} scripts named';
    events.next({ type: 'translationLoadSuccess' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toBe('0 scripts named');
  });

  it('surfaces a genuinely missing key once its namespace is loaded, instead of rendering blank', () => {
    // The scope is loaded (other keys in the same namespace are there) but this key's `.other`
    // fallback was never written — a real translation gap, which has to fail the test run through
    // `ThrowingMissingHandler` (#149/#162) rather than silently render nothing forever.
    expect(() => setUp('en', { 'summary.total.other': '{{count}} in total' })).toThrow(
      /Missing key "summary.named.other"/,
    );
  });

  it('re-renders on a language change with nothing left to load', () => {
    // Switching back to an already-visited language fires no `translationLoadSuccess` — it is
    // cached — so the pipe has to mark its view for check on `langChanges$` too, or an `OnPush`
    // host whose inputs didn't change keeps rendering the previous language (issue #187).
    const { fixture, service } = setUp(
      'en',
      {
        'summary.named.one': '{{count}} script named',
        'summary.named.other': '{{count}} scripts named',
        'summary.named.few': '{{count}} نصوص',
      },
      { count: 3 },
    );
    expect(fixture.nativeElement.textContent).toBe('3 scripts named');

    service.setActiveLang('ar');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toBe('3 نصوص');
  });
});
