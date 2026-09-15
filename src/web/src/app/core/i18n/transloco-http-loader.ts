import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

/**
 * Fetches translation JSON over HTTP (same origin, allowed by the production
 * `connect-src 'self'`), lazily per scope. Transloco calls `getTranslation(langPath)` with just
 * `<lang>` for the root/shell scope and `<scope>/<lang>` for a feature scope; the path shape below
 * is what the two asset globs in `angular.json` produce:
 * - root: `public/assets/i18n/<lang>.json` → served at `assets/i18n/<lang>.json`.
 * - per-feature: `features/<feature>/i18n/<lang>.json` → served at
 *   `assets/i18n/<feature>/i18n/<lang>.json` (the glob preserves each feature's own `i18n/`
 *   subfolder, which is what lets a new feature scope work without editing `angular.json`).
 */
@Injectable({ providedIn: 'root' })
export class AppTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(langPath: string) {
    const [scope, lang] = langPath.includes('/') ? langPath.split('/') : [null, langPath];
    const url = scope ? `assets/i18n/${scope}/i18n/${lang}.json` : `assets/i18n/${lang}.json`;
    return this.http.get<Translation>(url);
  }
}
