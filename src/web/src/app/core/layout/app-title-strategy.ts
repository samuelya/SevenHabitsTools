import { effect, inject, Injectable, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs';

/**
 * Routes set `title` to a key in the root/shell scope — `titles.<name>` (or a resolver returning
 * one, see `habits.routes.ts`'s `habitTitle`), never a feature scope's own key. The key drives
 * both the document title (set here) and the top app bar title (`Shell` reads `pageTitle`).
 *
 * Route and page titles are a shell concern (the browser tab, the app bar), read by shell-level
 * code that runs outside any particular feature's scoped injector, and often before that scope
 * has even loaded — a title living in a lazy feature scope is structurally the wrong place and
 * can't resolve reliably there (#149). The root scope is always loaded (`LanguageSync.initialize()`
 * awaits it before the app ever renders), so `pageTitle` below can stay a plain, always-loaded
 * `selectTranslate()` — reactive to the key *and* to a later language switch, with nothing scope-
 * specific to reload.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly key = signal('');

  /** Translation key of the current page title; empty when the route has none. */
  readonly titleKey = this.key.asReadonly();

  /** The current page's title, already translated; falls back to the app name when the route has
   * none. Read by `Shell` for the on-screen top app bar title. */
  readonly pageTitle = toSignal(
    toObservable(this.key).pipe(
      switchMap((key) => this.transloco.selectTranslate(key || 'app.name')),
    ),
    { initialValue: '' },
  );

  constructor() {
    super();
    effect(() => {
      const pageTitle = this.pageTitle();
      const appName = this.transloco.translate('app.name');
      this.title.setTitle(this.key() ? `${pageTitle} | ${appName}` : appName);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot) ?? '');
  }
}
