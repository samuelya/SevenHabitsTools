import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs';

/**
 * Routes set `title` to a Transloco key (or a resolver returning one). The key drives the top app
 * bar title (reactively, in `Shell`) and the document title, set here through `selectTranslate()`
 * rather than an instant `translate()` call: the key's scope may still be loading (it loads
 * lazily with the route, see `home.routes.ts` and friends), and reacting to it is what lets the
 * document title catch up once it resolves instead of racing it.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly key = signal('');

  /** Translation key of the current page title; empty when the route has none. */
  readonly titleKey = this.key.asReadonly();

  constructor() {
    super();
    toObservable(this.key)
      .pipe(
        switchMap((key) => this.transloco.selectTranslate(key || 'app.name')),
        takeUntilDestroyed(),
      )
      .subscribe((pageTitle) => {
        const appName = this.transloco.translate('app.name');
        this.title.setTitle(this.key() ? `${pageTitle} | ${appName}` : appName);
      });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot) ?? '');
  }
}
