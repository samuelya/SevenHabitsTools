import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { AppTitleStrategy } from './app-title-strategy';

@Component({ selector: 'app-test-page', template: '' })
class TestPage {}

function fakeTransloco(activeLang = 'en') {
  return {
    langChanges$: new BehaviorSubject(activeLang),
    load: vi.fn().mockReturnValue(of({})),
    translate: vi.fn((key: string) => key),
  };
}

/**
 * Neither `translate()` nor `selectTranslate()` loads a feature scope on their own, and passing
 * one explicitly re-prefixes an already-qualified key (`about.title` -> `about.about.title`,
 * `config.scopes.autoPrefixKeys`) — see the class doc comment. `RouterTestingHarness` (rather
 * than a bare `Router.navigateByUrl()`) is what actually drives `TitleStrategy.updateTitle()`: it
 * needs a live `RouterOutlet`.
 */
describe('AppTitleStrategy', () => {
  it("loads a scoped title key's data.titleScope, then translates the plain key against the plain language", async () => {
    const transloco = fakeTransloco();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([
          { path: '', title: 'about.title', data: { titleScope: 'about' }, component: TestPage },
        ]),
      ],
    });

    await RouterTestingHarness.create('/');

    expect(transloco.load).toHaveBeenCalledWith('about/en');
    expect(transloco.translate).toHaveBeenCalledWith('about.title', {}, 'en');
  });

  it('loads only the root scope, and translates against it, for a root-scope title key', async () => {
    const transloco = fakeTransloco();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([{ path: '', title: 'nav.home', component: TestPage }]),
      ],
    });

    await RouterTestingHarness.create('/');

    expect(transloco.load).toHaveBeenCalledWith('en');
    expect(transloco.translate).toHaveBeenCalledWith('nav.home', {}, 'en');
  });

  it('falls back to app.name when the route has no title', async () => {
    const transloco = fakeTransloco();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([{ path: '', component: TestPage }]),
      ],
    });

    await RouterTestingHarness.create('/');

    expect(transloco.translate).toHaveBeenCalledWith('app.name', {}, 'en');
    expect(TestBed.inject(AppTitleStrategy).titleKey()).toBe('');
  });

  it('re-translates against the new language on a later switch, without navigating', async () => {
    const transloco = fakeTransloco();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([
          { path: '', title: 'about.title', data: { titleScope: 'about' }, component: TestPage },
        ]),
      ],
    });
    await RouterTestingHarness.create('/');
    transloco.load.mockClear();
    transloco.translate.mockClear();

    transloco.langChanges$.next('ar');

    expect(transloco.load).toHaveBeenCalledWith('about/ar');
    expect(transloco.translate).toHaveBeenCalledWith('about.title', {}, 'ar');
  });
});
