import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppTitleStrategy } from '../../../core/layout/app-title-strategy';

/** Temporary page for destinations whose feature has not been built yet. Only ever bound to a
 * root-scope title key (`nav.journal`, `nav.plan`), so `'placeholder.comingSoon'` — also root
 * scope — is the only translation it needs. */
@Component({
  selector: 'app-placeholder-page',
  imports: [TranslocoPipe],
  template: `
    <h1 class="page-heading">{{ titles.titleKey() | transloco }}</h1>
    <p>{{ 'placeholder.comingSoon' | transloco }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderPage {
  protected readonly titles = inject(AppTitleStrategy);
}
