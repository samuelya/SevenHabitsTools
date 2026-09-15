import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Labels } from '../../core/i18n/labels';
import { AppVersionService } from './app-version.service';

/** Public repository this app is developed in; linked from the About page. */
export const REPO_URL = 'https://github.com/samuelya/SevenHabitsTools';

@Component({
  selector: 'app-about-page',
  imports: [RouterLink],
  template: `
    <h1 class="page-heading">{{ labels.text('about.title') }}</h1>
    <p>{{ labels.text('about.notAffiliated') }}</p>
    <p>{{ labels.text('about.recommendation') }}</p>
    <p>{{ labels.text('about.versionLabel') }}: {{ appVersion.version() ?? unknownVersion }}</p>
    <p>
      <a [href]="repoUrl" target="_blank" rel="noopener">{{ labels.text('about.repoLink') }}</a>
    </p>
    <p>
      <a routerLink="/settings" fragment="privacy">{{ labels.text('about.privacyLink') }}</a>
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPage {
  protected readonly labels = inject(Labels);
  protected readonly appVersion = inject(AppVersionService);
  protected readonly repoUrl = REPO_URL;
  protected readonly unknownVersion = this.labels.text('about.versionUnknown');
}
