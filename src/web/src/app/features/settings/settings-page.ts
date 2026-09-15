import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Labels } from '../../core/i18n/labels';

/** Settings placeholder content, plus the privacy note that `/about` links to. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink],
  template: `
    <h1 class="page-heading">{{ labels.text('nav.settings') }}</h1>
    <p>{{ labels.text('placeholder.comingSoon') }}</p>
    <section id="privacy">
      <h2>{{ labels.text('settings.privacyTitle') }}</h2>
      <p>{{ labels.text('settings.privacyNote') }}</p>
    </section>
    <p>
      <a routerLink="/about">{{ labels.text('nav.about') }}</a>
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly labels = inject(Labels);
}
