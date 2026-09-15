import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import shellEn from '../../../public/assets/i18n/en.json';
import shellAr from '../../../public/assets/i18n/ar.json';
import homeEn from '../features/home/i18n/en.json';
import homeAr from '../features/home/i18n/ar.json';
import habitsEn from '../features/habits/i18n/en.json';
import habitsAr from '../features/habits/i18n/ar.json';
import aboutEn from '../features/about/i18n/en.json';
import aboutAr from '../features/about/i18n/ar.json';
import settingsEn from '../features/settings/i18n/en.json';
import settingsAr from '../features/settings/i18n/ar.json';

/**
 * Real translations, loaded synchronously (`TranslocoTestingModule`, no HTTP) instead of a
 * loader — the same JSON the app ships, so a spec's rendered text always matches production and
 * nobody has to keep a second copy of every string in sync. Included by `configureApp()`
 * (`app-test-setup.ts`); a spec that builds its `TestBed` module directly (not through
 * `configureApp`) adds it to its own `providers` instead.
 */
export function provideTranslocoTesting(): EnvironmentProviders {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: {
        en: shellEn,
        ar: shellAr,
        'home/en': homeEn,
        'home/ar': homeAr,
        'habits/en': habitsEn,
        'habits/ar': habitsAr,
        'about/en': aboutEn,
        'about/ar': aboutAr,
        'settings/en': settingsEn,
        'settings/ar': settingsAr,
      },
      preloadLangs: true,
      translocoConfig: {
        availableLangs: ['en', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: true,
      },
    }),
  );
}
