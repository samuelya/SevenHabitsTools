import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Labels } from '../../../core/i18n/labels';

/** Public repository this app is developed in. Single source of truth for the URL. */
export const REPO_URL = 'https://github.com/samuelya/SevenHabitsTools';

/**
 * Link to the project's public repository, styled as a `mat-list-item` row (icon, optional
 * label, optional trailing "opens in a new tab" indicator) so it can sit directly in a
 * `mat-nav-list` and look like the other rows. `mat-list-item` renders correctly outside a
 * `<mat-list>` too, so the same markup also works as a standalone row. Used as a footer row in
 * the desktop side-nav (`Shell`) and, with the same inputs, on the About page's mobile entry
 * point (`AboutPage`) — both places render this component instead of duplicating the markup.
 */
@Component({
  selector: 'app-github-link',
  imports: [MatIconModule, MatListModule],
  template: `
    <a
      mat-list-item
      class="github-link"
      [href]="repoUrl"
      target="_blank"
      rel="noopener noreferrer"
      [attr.aria-label]="accessibleName"
    >
      <mat-icon svgIcon="github" matListItemIcon aria-hidden="true" />
      @if (showLabel()) {
        <span matListItemTitle>{{ labels.text('nav.github') }}</span>
      }
      @if (showExternalIcon()) {
        <mat-icon matListItemMeta class="github-link__external" aria-hidden="true"
          >open_in_new</mat-icon
        >
      }
    </a>
  `,
  styleUrl: './github-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubLink {
  protected readonly labels = inject(Labels);
  protected readonly repoUrl = REPO_URL;
  protected readonly accessibleName = this.labels.text('nav.githubExternalLabel');

  /** Shows the visible "GitHub" text label next to the icon. */
  readonly showLabel = input(false);

  /** Shows a small trailing icon indicating the link opens in a new tab. */
  readonly showExternalIcon = input(false);
}
