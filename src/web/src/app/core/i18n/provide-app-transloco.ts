import { EnvironmentProviders, isDevMode } from '@angular/core';
import { provideTransloco, provideTranslocoMissingHandler } from '@jsverse/transloco';
import { LANGUAGES } from './language';
import { AppTranslocoLoader } from './transloco-http-loader';
import { ThrowingMissingHandler } from './throwing-missing-handler';

/**
 * Transloco configuration (issue #28): `en` (default) and `ar`, with a missing-key handler that
 * logs to the console in dev builds only and falls back to `en` — `fallbackLang` picks the
 * language, `useFallbackTranslation` is what actually renders it instead of the raw key. In dev
 * (`logMissingKey: isDevMode()`), a key still missing from `en` after that fallback throws via
 * `ThrowingMissingHandler` instead of quietly rendering — the same guard `provideTranslocoTesting()`
 * wires into every spec, so a cross-scope key (#149, #162) fails loudly rather than reaching a
 * real screen.
 */
export function provideAppTransloco(): EnvironmentProviders[] {
  return [
    ...provideTransloco({
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
    }),
    provideTranslocoMissingHandler(ThrowingMissingHandler),
  ];
}
