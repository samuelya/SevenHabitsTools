import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule, provideTranslocoMissingHandler } from '@jsverse/transloco';
import { ThrowingMissingHandler } from '../core/i18n/throwing-missing-handler';
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
import exerciseKitEn from '../shared/exercise-kit/i18n/en.json';
import exerciseKitAr from '../shared/exercise-kit/i18n/ar.json';

/**
 * Real translations, loaded synchronously (`TranslocoTestingModule`, no HTTP) instead of a
 * loader — the same JSON the app ships, so a spec's rendered text always matches production and
 * nobody has to keep a second copy of every string in sync. Included by `configureApp()`
 * (`app-test-setup.ts`); a spec that builds its `TestBed` module directly (not through
 * `configureApp`) adds it to its own `providers` instead.
 *
 * `logMissingKey: true` plus `ThrowingMissingHandler` (the same guard `provideAppTransloco()`
 * wires in for dev builds) makes a missing key — most often a cross-scope reference such as
 * #149/#162 — fail the spec instead of silently rendering the raw key.
 */
export function provideTranslocoTesting(): EnvironmentProviders[] {
  return [
    importProvidersFrom(
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
          'exercise-kit/en': exerciseKitEn,
          'exercise-kit/ar': exerciseKitAr,
        },
        preloadLangs: true,
        translocoConfig: {
          availableLangs: ['en', 'ar'],
          defaultLang: 'en',
          reRenderOnLangChange: true,
          prodMode: true,
          missingHandler: {
            logMissingKey: true,
            useFallbackTranslation: true,
            allowEmpty: false,
          },
        },
      }),
    ),
    provideTranslocoMissingHandler(ThrowingMissingHandler),
  ];
}
