import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { HABITS } from '../../core/habits/habits';
import { Labels } from '../../core/i18n/labels';

@Component({
  selector: 'app-habits-page',
  imports: [MatIconModule, MatListModule, RouterLink],
  template: `
    <h1 class="page-heading">{{ labels.text('nav.habits') }}</h1>
    <p>{{ labels.text('habits.intro') }}</p>
    <mat-nav-list>
      @for (habit of habits; track habit.id) {
        <a mat-list-item [routerLink]="habit.id">
          <mat-icon matListItemIcon aria-hidden="true">{{ habit.icon }}</mat-icon>
          <span matListItemTitle>{{ labels.text(habit.titleKey) }}</span>
        </a>
      }
    </mat-nav-list>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitsPage {
  protected readonly labels = inject(Labels);
  protected readonly habits = HABITS;
}
