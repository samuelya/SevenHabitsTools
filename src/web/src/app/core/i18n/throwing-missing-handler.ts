import { Injectable } from '@angular/core';
import { TranslocoMissingHandler, TranslocoMissingHandlerData } from '@jsverse/transloco';

/**
 * A missing Transloco key almost always means a cross-scope key reference (#149, #162): a shared
 * or feature component asking for a string that isn't in any scope it has loaded. `DefaultMissingHandler`
 * only logs a console warning and renders the raw key, so that class of bug can reach a real
 * screen unnoticed. Whenever `missingHandler.logMissingKey` is on — dev builds and every test,
 * see `provideAppTransloco()` and `provideTranslocoTesting()` — this throws instead, so a missing
 * key fails the build or the test run rather than shipping. Production (`logMissingKey: false`)
 * keeps the default's silent, key-returning fallback so a translation gap never crashes a user's
 * screen.
 */
@Injectable({ providedIn: 'root' })
export class ThrowingMissingHandler implements TranslocoMissingHandler {
  handle(key: string, data: TranslocoMissingHandlerData): string {
    if (data.missingHandler.logMissingKey) {
      throw new Error(
        `Missing Transloco key "${key}" for lang "${data.activeLang}". ` +
          'Shared and core components may only use root-scope keys; a feature-scoped key ' +
          "needs its own root-scope entry instead (see #149, #162 in the project's issue history).",
      );
    }
    return key;
  }
}
