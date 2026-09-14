import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Labels } from '../../../core/i18n/labels';
import { AppTitleStrategy } from '../../../core/layout/app-title-strategy';

/** Temporary page for destinations whose feature has not been built yet. */
@Component({
  selector: 'app-placeholder-page',
  template: `
    <h1 class="page-heading">{{ heading() }}</h1>
    <p>{{ labels.text('placeholder.comingSoon') }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderPage {
  private readonly titles = inject(AppTitleStrategy);
  protected readonly labels = inject(Labels);

  protected readonly heading = computed(() => this.labels.text(this.titles.titleKey()));
}
