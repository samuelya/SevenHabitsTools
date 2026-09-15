import { EnvironmentProviders, isDevMode } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { LANGUAGES } from './language';
import { AppTranslocoLoader } from './transloco-http-loader';

/**
 * Transloco configuration (issue #28): `en` (default) and `ar`, with a missing-key handler that
 * logs to the console in dev builds only and falls back to `en` — `fallbackLang` picks the
 * language, `useFallbackTranslation` is what actually renders it instead of the raw key.
 */
export function provideAppTransloco(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...LANGUAGES],
      defaultLang: 'en',
      fallbackLang: 'en',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: {
        logMissingKey: isDevMode(),
        useFallbackTranslation: true,
        allowEmpty: false,
      },
    },
    loader: AppTranslocoLoader,
  });
}
