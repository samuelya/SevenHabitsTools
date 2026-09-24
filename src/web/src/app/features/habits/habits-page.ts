import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { HABITS, HabitId } from '../../core/habits/habits';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { HabitExerciseProgress } from '../../shared/exercise-kit/exercise-progress.logic';
import { habitListLayout, laterLabel, progressPercentage } from './habits.logic';

/** The habits list (issue #219): habits with exercises and the one that comes next, then every
 * other habit collapsed under one expandable "coming soon" row. */
@Component({
  selector: 'app-habits-page',
  imports: [
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    RouterLink,
    TranslocoPipe,
    AppPluralPipe,
  ],
  templateUrl: './habits-page.html',
  styleUrl: './habits-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitsPage {
  private readonly progress = inject(ExerciseProgress);

  protected readonly progressPercentage = progressPercentage;

  /** Registered exercises are fixed at module load, so the split only reads `total`, never `done`. */
  protected readonly layout = computed(() =>
    habitListLayout(HABITS, (habit) => this.progressFor(habit)().total > 0),
  );

  protected readonly laterLabel = computed(() =>
    laterLabel(this.layout().later.map((habit) => habit.id)),
  );

  /** Page-local UI state: the "later" row starts collapsed on every visit. */
  protected readonly laterExpanded = signal(false);

  protected progressFor(habit: HabitId): Signal<HabitExerciseProgress> {
    return this.progress.progressFor(habit);
  }

  protected toggleLater(): void {
    this.laterExpanded.update((expanded) => !expanded);
  }
}
