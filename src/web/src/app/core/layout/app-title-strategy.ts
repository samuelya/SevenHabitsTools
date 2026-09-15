import { effect, inject, Injectable, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { map, switchMap } from 'rxjs';

/**
 * Routes set `title` to a Transloco key (or a resolver returning one, see `habits.routes.ts`'s
 * `habitTitle`). The key drives both the document title (set here) and the top app bar title
 * (`Shell` reads `pageTitle`).
 *
 * Neither `translate()` nor `selectTranslate()` loads a *feature* scope on their own — passed a
 * bare key they only ever load the root/shell scope (see their own doc comments) — and passing
 * one explicitly as the `lang` argument doesn't help either: `TranslocoPipe` itself never does
 * that (it resolves its own scope only to trigger *loading*, then translates through the plain
 * resolved language), and doing so instead re-prefixes an already-scope-qualified key like
 * `about.title` into `about.about.title` (`config.scopes.autoPrefixKeys`, on by default). So a
 * route whose title key lives in a feature scope pairs it with `data: { titleScope: '<scope>' }`
 * next to `provideTranslocoScope()` (see `about.routes.ts`) — not to pass to `translate()`, but
 * so `pageTitle` below can explicitly `load()` that scope for the active language *before*
 * translating the (still fully-qualified) key against the plain language, the same order
 * `TranslocoPipe` follows. `getResolvedTitleForRoute()` is `TitleStrategy.buildTitle()`'s own
 * per-route hook, overridden only to also remember which route the title came from.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly key = signal('');
  private readonly scope = signal<string | undefined>(undefined);
  private pendingScope: string | undefined;

  /** Translation key of the current page title; empty when the route has none. */
  readonly titleKey = this.key.asReadonly();

  /** The current page's title, already translated; falls back to the app name when the route has
   * none. Reacts to a later language switch too. Read by `Shell` for the on-screen top app bar
   * title. */
  readonly pageTitle = toSignal(
    toObservable(this.key).pipe(
      switchMap((key) =>
        this.transloco.langChanges$.pipe(
          switchMap((lang) => {
            const scope = this.scope();
            const ensureLoaded = this.transloco.load(scope ? `${scope}/${lang}` : lang);
            return ensureLoaded.pipe(
              map(() => this.transloco.translate(key || 'app.name', {}, lang)),
            );
          }),
        ),
      ),
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

  override getResolvedTitleForRoute(snapshot: ActivatedRouteSnapshot): string | undefined {
    const title = super.getResolvedTitleForRoute(snapshot);
    if (title !== undefined) {
      this.pendingScope = snapshot.data['titleScope'] as string | undefined;
    }
    return title;
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pendingScope = undefined;
    const key = this.buildTitle(snapshot) ?? '';
    this.scope.set(this.pendingScope);
    this.key.set(key);
  }
}
