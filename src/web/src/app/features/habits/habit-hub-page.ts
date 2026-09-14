import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { findHabit, isHabitId } from '../../core/habits/habits';
import { Labels } from '../../core/i18n/labels';
import { hubEntriesFor } from '../../core/routing/build-routes';
import { FEATURE_ROUTES } from '../../core/routing/feature-route';

/** Placeholder hub for one habit; lists the exercises registered with `hub.habit`. */
@Component({
  selector: 'app-habit-hub-page',
  imports: [MatIconModule, MatListModule, RouterLink],
  template: `
    @if (habitDefinition(); as definition) {
      <h1 class="page-heading">{{ labels.text(definition.titleKey) }}</h1>
    }
    @if (entries().length) {
      <mat-nav-list>
        @for (entry of entries(); track entry.path) {
          <a mat-list-item [routerLink]="'/' + entry.path">
            <mat-icon matListItemIcon aria-hidden="true">{{ entry.icon }}</mat-icon>
            <span matListItemTitle>{{ labels.text(entry.titleKey) }}</span>
          </a>
        }
      </mat-nav-list>
    } @else {
      <p>{{ labels.text('hub.noExercises') }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitHubPage {
  private readonly registry = inject(FEATURE_ROUTES);
  protected readonly labels = inject(Labels);

  /** Route parameter, bound through `withComponentInputBinding`. */
  readonly habit = input.required<string>();

  protected readonly habitDefinition = computed(() => findHabit(this.habit()));

  protected readonly entries = computed(() => {
    const habit = this.habit();
    return isHabitId(habit) ? hubEntriesFor(this.registry, habit) : [];
  });
}
