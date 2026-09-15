import { TestBed } from '@angular/core/testing';
import { DocumentStore } from '../data/document.store';
import '../../features/settings/settings.model';
import { BROWSER_LANGUAGE } from './browser-language';
import { LanguageStore } from './language-store';

describe('LanguageStore', () => {
  it('defaults to the browser language and Western numerals', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: BROWSER_LANGUAGE, useValue: 'ar-SA' }],
    });

    const store = TestBed.inject(LanguageStore);

    expect(store.language()).toBe('ar');
    expect(store.numerals()).toBe('western');
  });

  it('setLanguage() persists the choice, overriding the browser default', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: BROWSER_LANGUAGE, useValue: 'ar-SA' }],
    });
    const store = TestBed.inject(LanguageStore);

    store.setLanguage('en');

    expect(store.language()).toBe('en');
    expect(TestBed.inject(DocumentStore).document().settings).toEqual({
      language: 'en',
      numerals: 'western',
    });
  });

  it('setNumerals() persists the choice without touching language', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: BROWSER_LANGUAGE, useValue: 'en-US' }],
    });
    const store = TestBed.inject(LanguageStore);

    store.setNumerals('arabic');

    expect(store.numerals()).toBe('arabic');
    expect(store.language()).toBe('en');
  });
});
