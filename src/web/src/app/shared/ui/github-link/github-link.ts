import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Labels } from '../../../core/i18n/labels';

/** Public repository this app is developed in. Single source of truth for the URL. */
export const REPO_URL = 'https://github.com/samuelya/SevenHabitsTools';

/**
 * Link to the project's public repository: the official GitHub mark plus an optional visible
 * text label. Used icon-only in the desktop side-nav footer (`Shell`) and with the label shown
 * on the About page's mobile entry point (`AboutPage`), so both places render the same markup
 * instead of duplicating it.
 */
@Component({
  selector: 'app-github-link',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <a
      class="github-link"
      [href]="repoUrl"
      target="_blank"
      rel="noopener noreferrer"
      [attr.aria-label]="accessibleName"
      [matTooltip]="accessibleName"
    >
      <mat-icon svgIcon="github" class="github-link__icon" aria-hidden="true" />
      @if (showLabel()) {
        <span class="github-link__label">{{ labels.text('nav.github') }}</span>
      }
    </a>
  `,
  styleUrl: './github-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubLink {
  protected readonly labels = inject(Labels);
  protected readonly repoUrl = REPO_URL;
  protected readonly accessibleName = this.labels.text('about.repoLink');

  /** Shows the visible "GitHub" text label next to the icon (the mobile About page entry). */
  readonly showLabel = input(false);
}
