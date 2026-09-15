import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatRippleModule } from '@angular/material/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, map, switchMap } from 'rxjs';
import { ReadOnlyBanner } from '../../data/multi-tab/read-only-banner';
import { LanguageToggle } from '../../i18n/language-toggle/language-toggle';
import { OfflineIndicator } from '../../pwa/offline-indicator';
import { PwaInstallBanner } from '../../pwa/pwa-install-banner';
import { GithubLink } from '../../../shared/ui/github-link/github-link';
import { AppTitleStrategy } from '../app-title-strategy';
import { NAV_ITEMS } from '../nav-items';

/** Below this width the shell uses bottom navigation instead of the side navigation. */
export const HANDSET_QUERY = '(max-width: 599.98px)';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    GithubLink,
    LanguageToggle,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatRippleModule,
    MatSidenavModule,
    MatToolbarModule,
    OfflineIndicator,
    PwaInstallBanner,
    ReadOnlyBanner,
    TranslocoPipe,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly titles = inject(AppTitleStrategy);
  private readonly transloco = inject(TranslocoService);

  protected readonly navItems = NAV_ITEMS;

  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Reactive rather than an instant `translate()` call: a feature route's title key lives in a
   * scope that may still be loading (it loads lazily with the route, see `home.routes.ts` and
   * friends), and `selectTranslate()` re-emits once it resolves. */
  protected readonly pageTitle = toSignal(
    toObservable(this.titles.titleKey).pipe(
      switchMap((key) => this.transloco.selectTranslate(key || 'app.name')),
    ),
    { initialValue: '' },
  );

  /** Parent URL for the back button; `null` on top-level pages. */
  protected readonly backUrl = computed(() => {
    const segments = this.router.parseUrl(this.url()).root.children['primary']?.segments ?? [];
    return segments.length > 1
      ? '/' +
          segments
            .slice(0, -1)
            .map((segment) => segment.path)
            .join('/')
      : null;
  });
}
