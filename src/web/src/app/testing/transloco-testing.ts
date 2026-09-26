import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import {
  Translation,
  TranslocoTestingModule,
  provideTranslocoMissingHandler,
} from '@jsverse/transloco';
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
import transitionEn from '../features/paradigms-transition/i18n/en.json';
import transitionAr from '../features/paradigms-transition/i18n/ar.json';
import pcBalanceEn from '../features/paradigms-pc-balance/i18n/en.json';
import pcBalanceAr from '../features/paradigms-pc-balance/i18n/ar.json';
import maturityEn from '../features/paradigms-maturity/i18n/en.json';
import maturityAr from '../features/paradigms-maturity/i18n/ar.json';
import teachEn from '../features/paradigms-teach/i18n/en.json';
import teachAr from '../features/paradigms-teach/i18n/ar.json';
import perceptionEn from '../features/paradigms-perception/i18n/en.json';
import perceptionAr from '../features/paradigms-perception/i18n/ar.json';
import commitmentsEn from '../features/h1-commitments/i18n/en.json';
import commitmentsAr from '../features/h1-commitments/i18n/ar.json';
import rolesEn from '../features/h2-roles/i18n/en.json';
import rolesAr from '../features/h2-roles/i18n/ar.json';
import circleEn from '../features/h1-circle/i18n/en.json';
import circleAr from '../features/h1-circle/i18n/ar.json';
import rehearsalEn from '../features/h1-rehearsal/i18n/en.json';
import rehearsalAr from '../features/h1-rehearsal/i18n/ar.json';
import challengeEn from '../features/h1-challenge/i18n/en.json';
import challengeAr from '../features/h1-challenge/i18n/ar.json';
import languageEn from '../features/h1-language/i18n/en.json';
import languageAr from '../features/h1-language/i18n/ar.json';
import exerciseKitEn from '../shared/exercise-kit/i18n/en.json';
import exerciseKitAr from '../shared/exercise-kit/i18n/ar.json';

/** Every shipped translation file, keyed the way Transloco loads it (`<lang>` for the root scope,
 * `<scope>/<lang>` for a feature scope). A new scope is added here once, for both its specs and
 * `core/i18n/en-gb-spelling.spec.ts`. */
export const TEST_TRANSLATIONS: Readonly<Record<string, Translation>> = {
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
  'paradigms-transition/en': transitionEn,
  'paradigms-transition/ar': transitionAr,
  'paradigms-pc-balance/en': pcBalanceEn,
  'paradigms-pc-balance/ar': pcBalanceAr,
  'paradigms-maturity/en': maturityEn,
  'paradigms-maturity/ar': maturityAr,
  'paradigms-teach/en': teachEn,
  'paradigms-teach/ar': teachAr,
  'paradigms-perception/en': perceptionEn,
  'paradigms-perception/ar': perceptionAr,
  'h1-commitments/en': commitmentsEn,
  'h1-commitments/ar': commitmentsAr,
  'h2-roles/en': rolesEn,
  'h2-roles/ar': rolesAr,
  'h1-circle/en': circleEn,
  'h1-circle/ar': circleAr,
  'h1-rehearsal/en': rehearsalEn,
  'h1-rehearsal/ar': rehearsalAr,
  'h1-challenge/en': challengeEn,
  'h1-challenge/ar': challengeAr,
  'h1-language/en': languageEn,
  'h1-language/ar': languageAr,
  'exercise-kit/en': exerciseKitEn,
  'exercise-kit/ar': exerciseKitAr,
};

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
        langs: { ...TEST_TRANSLATIONS },
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
