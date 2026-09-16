import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import '../../../features/settings/settings.model';
import { BROWSER_LANGUAGE } from '../browser-language';
import { LanguageStore } from '../language-store';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { LanguageToggle } from './language-toggle';

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), { provide: BROWSER_LANGUAGE, useValue: 'en-US' }],
  });
  const fixture = TestBed.createComponent(LanguageToggle);
  fixture.detectChanges();
  return fixture;
}

describe('LanguageToggle', () => {
  it('announces the language a click would switch to', () => {
    const fixture = setUp();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Switch to Arabic');
  });

  it('switches to the other language on click', () => {
    const fixture = setUp();

    fixture.nativeElement.querySelector('button').click();

    expect(TestBed.inject(LanguageStore).language()).toBe('ar');
  });

  it('offers to switch back to English, in Arabic, once Arabic is active', () => {
    const fixture = setUp();
    TestBed.inject(LanguageStore).setLanguage('ar');
    // In the running app, `LanguageSync` (tested on its own) is what keeps this in step with
    // `LanguageStore`; set it directly here so this spec only exercises `LanguageToggle` itself.
    TestBed.inject(TranslocoService).setActiveLang('ar');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('التبديل إلى الإنجليزية');

    button.click();

    expect(TestBed.inject(LanguageStore).language()).toBe('en');
  });
});
