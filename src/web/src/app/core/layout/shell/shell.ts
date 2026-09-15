import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatRippleModule } from '@angular/material/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ReadOnlyBanner } from '../../data/multi-tab/read-only-banner';
import { Labels } from '../../i18n/labels';
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
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatRippleModule,
    MatSidenavModule,
    MatToolbarModule,
    OfflineIndicator,
    PwaInstallBanner,
    ReadOnlyBanner,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly titles = inject(AppTitleStrategy);
  protected readonly labels = inject(Labels);

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

  protected readonly pageTitle = computed(() => {
    const key = this.titles.titleKey();
    return key ? this.labels.text(key) : this.labels.text('app.name');
  });

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
