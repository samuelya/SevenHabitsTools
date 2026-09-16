import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { GithubLink } from '../../shared/ui/github-link/github-link';
import { AppVersionService } from './app-version.service';

@Component({
  selector: 'app-about-page',
  imports: [RouterLink, GithubLink, TranslocoPipe],
  template: `
    <h1 class="page-heading">{{ 'about.title' | transloco }}</h1>
    <p>{{ 'about.notAffiliated' | transloco }}</p>
    <p>{{ 'about.recommendation' | transloco }}</p>
    <p>
      {{ 'about.versionLabel' | transloco }}:
      {{ appVersion.version() ?? ('about.versionUnknown' | transloco) }}
    </p>
    <div class="about-page__github">
      <app-github-link [showLabel]="true" [showExternalIcon]="true" />
    </div>
    <p>
      <a routerLink="/settings" fragment="privacy">{{ 'about.privacyLink' | transloco }}</a>
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
  protected readonly appVersion = inject(AppVersionService);
}
