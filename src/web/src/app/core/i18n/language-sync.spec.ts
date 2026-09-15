import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { DocumentStore } from '../data/document.store';
import '../../features/settings/settings.model';
import { BROWSER_LANGUAGE } from './browser-language';
import { LanguageSync } from './language-sync';

function fakeTransloco() {
  return {
    load: vi.fn().mockReturnValue(of({})),
    setActiveLang: vi.fn(),
  };
}

function fakeDocument() {
  return { documentElement: { lang: '', dir: '' } };
}

describe('LanguageSync', () => {
  it('defaults to the browser language when nothing was chosen', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useFactory: fakeTransloco },
        { provide: DOCUMENT, useFactory: fakeDocument },
        { provide: BROWSER_LANGUAGE, useValue: 'ar-SA' },
      ],
    });

    expect(TestBed.inject(LanguageSync).effectiveLanguage()).toBe('ar');
  });

  it('prefers the persisted choice over the browser language', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useFactory: fakeTransloco },
        { provide: DOCUMENT, useFactory: fakeDocument },
        { provide: BROWSER_LANGUAGE, useValue: 'ar-SA' },
      ],
    });
    TestBed.inject(DocumentStore).update('settings', () => ({
      language: 'en',
      numerals: 'western',
    }));

    expect(TestBed.inject(LanguageSync).effectiveLanguage()).toBe('en');
  });

  it('initialize() loads and applies the effective language before returning', async () => {
    const transloco = fakeTransloco();
    const document = fakeDocument();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: DOCUMENT, useValue: document },
        { provide: BROWSER_LANGUAGE, useValue: 'ar-SA' },
      ],
    });
    const sync = TestBed.inject(LanguageSync);

    await sync.initialize();

    expect(transloco.load).toHaveBeenCalledWith('ar');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('start() applies a later change to the persisted language', async () => {
    const transloco = fakeTransloco();
    const document = fakeDocument();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: DOCUMENT, useValue: document },
        { provide: BROWSER_LANGUAGE, useValue: 'en-US' },
      ],
    });
    const store = TestBed.inject(DocumentStore);
    const sync = TestBed.inject(LanguageSync);
    await sync.initialize();
    sync.start();
    transloco.load.mockClear();
    transloco.setActiveLang.mockClear();

    store.update('settings', () => ({ language: 'ar', numerals: 'western' }));
    TestBed.tick();
    await Promise.resolve();

    expect(transloco.load).toHaveBeenCalledWith('ar');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
