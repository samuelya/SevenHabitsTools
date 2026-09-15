import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Labels } from '../../core/i18n/labels';
import { GithubLink } from '../../shared/ui/github-link/github-link';
import { AppVersionService } from './app-version.service';

@Component({
  selector: 'app-about-page',
  imports: [RouterLink, GithubLink],
  template: `
    <h1 class="page-heading">{{ labels.text('about.title') }}</h1>
    <p>{{ labels.text('about.notAffiliated') }}</p>
    <p>{{ labels.text('about.recommendation') }}</p>
    <p>{{ labels.text('about.versionLabel') }}: {{ appVersion.version() ?? unknownVersion }}</p>
    <div class="about-page__github">
      <app-github-link [showLabel]="true" [showExternalIcon]="true" />
    </div>
    <p>
      <a routerLink="/settings" fragment="privacy">{{ labels.text('about.privacyLink') }}</a>
    </p>
  `,
  styles: `
    .about-page__github {
      margin-block: 16px;
      max-inline-size: 320px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPage {
  protected readonly labels = inject(Labels);
  protected readonly appVersion = inject(AppVersionService);
  protected readonly unknownVersion = this.labels.text('about.versionUnknown');
}
