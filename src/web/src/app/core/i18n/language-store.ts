import { Injectable, Signal, computed, inject } from '@angular/core';
import { SettingsData } from '../../features/settings/settings.model';
import { featureStore } from '../data/feature-store';
import { BROWSER_LANGUAGE } from './browser-language';
import { Language, Numerals } from './language';
import { resolveEffectiveLanguage } from './language.logic';

/**
 * Read/write access to the persisted language and numerals preference (`settings.language`,
 * `settings.numerals`) — the data-access half of language switching. `LanguageSync` is the other
 * half: it applies `language` to Transloco and `<html>`, and never writes to the document itself.
 * The language switcher (shell menu and Settings) only needs this one.
 */
@Injectable({ providedIn: 'root' })
export class LanguageStore {
  private readonly settings = featureStore<SettingsData>('settings');
  private readonly browserLanguage = inject(BROWSER_LANGUAGE);

  /** The persisted choice, or the browser default while none has been made. */
  readonly language: Signal<Language> = computed(() =>
    resolveEffectiveLanguage(this.settings.value().language, this.browserLanguage),
  );
  readonly numerals: Signal<Numerals> = computed(() => this.settings.value().numerals);

  setLanguage(language: Language): void {
    this.settings.update((current) => ({ ...current, language }));
  }

  setNumerals(numerals: Numerals): void {
    this.settings.update((current) => ({ ...current, numerals }));
  }
}
