import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HABITS } from '../../core/habits/habits';

@Component({
  selector: 'app-habits-page',
  imports: [MatIconModule, MatListModule, RouterLink, TranslocoPipe],
  template: `
    <h1 class="page-heading">{{ 'nav.habits' | transloco }}</h1>
    <p>{{ 'habits.intro' | transloco }}</p>
    <mat-nav-list>
      @for (habit of habits; track habit.id) {
        <a mat-list-item [routerLink]="habit.id">
          <mat-icon matListItemIcon aria-hidden="true">{{ habit.icon }}</mat-icon>
          <span matListItemTitle>{{ habit.titleKey | transloco }}</span>
        </a>
      }
    </mat-nav-list>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitsPage {
  protected readonly habits = HABITS;
}
