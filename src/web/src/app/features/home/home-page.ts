import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Labels } from '../../core/i18n/labels';

@Component({
  selector: 'app-home-page',
  imports: [MatButtonModule, RouterLink],
  template: `
    <h1 class="page-heading">{{ labels.text('app.name') }}</h1>
    <p>{{ labels.text('home.welcome') }}</p>
    <a mat-flat-button routerLink="/habits">{{ labels.text('home.browseHabits') }}</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly labels = inject(Labels);
}
