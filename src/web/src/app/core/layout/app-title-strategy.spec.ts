import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, map } from 'rxjs';
import { AppTitleStrategy } from './app-title-strategy';

@Component({ selector: 'app-test-page', template: '' })
class TestPage {}

/** `selectTranslate(key)` (no explicit lang/scope) reacts to `langChanges$` in the real service —
 * this fake mirrors that instead of returning a fixed value, so a language switch is testable. */
function fakeTransloco(activeLang = 'en') {
  const langChanges$ = new BehaviorSubject(activeLang);
  const selectTranslate = vi.fn((key: string) =>
    langChanges$.pipe(map((lang) => `${key}(${lang})`)),
  );
  const translate = vi.fn((key: string) => `${key}(${langChanges$.value})`);
  return { langChanges$, selectTranslate, translate };
}

/**
 * `RouterTestingHarness` (rather than a bare `Router.navigateByUrl()`) is what actually drives
 * `TitleStrategy.updateTitle()`: it needs a live `RouterOutlet`.
 */
describe('AppTitleStrategy', () => {
  it('translates the route title key and sets both the page title and document.title', async () => {
    const transloco = fakeTransloco();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([{ path: '', title: 'titles.about', component: TestPage }]),
      ],
    });

    await RouterTestingHarness.create('/');

    const strategy = TestBed.inject(AppTitleStrategy);
    expect(strategy.titleKey()).toBe('titles.about');
    expect(strategy.pageTitle()).toBe('titles.about(en)');
    expect(document.title).toBe('titles.about(en) | app.name(en)');
  });

  it('falls back to the app name when the route has no title', async () => {
    const transloco = fakeTransloco();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([{ path: '', component: TestPage }]),
      ],
    });

    await RouterTestingHarness.create('/');

    expect(TestBed.inject(AppTitleStrategy).titleKey()).toBe('');
    expect(document.title).toBe('app.name(en)');
  });

  it('re-translates on a later language switch, without navigating', async () => {
    const transloco = fakeTransloco();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([{ path: '', title: 'titles.about', component: TestPage }]),
      ],
    });
    await RouterTestingHarness.create('/');

    transloco.langChanges$.next('ar');
    TestBed.tick();

    expect(TestBed.inject(AppTitleStrategy).pageTitle()).toBe('titles.about(ar)');
    expect(document.title).toBe('titles.about(ar) | app.name(ar)');
  });
});
