import { ChangeDetectionStrategy, Component, Signal, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { findHabit, isHabitId } from '../../core/habits/habits';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import {
  ExerciseRegistryEntry,
  getRegisteredExercises,
} from '../../shared/exercise-kit/exercise-registry';
import { ComingSoonExercise, HABIT_HUB_COMING_SOON } from './habit-hub-coming-soon';
import { nextExerciseRoute } from './habit-hub.logic';

/** Hub for one habit: lists its registered exercises with progress, an unregistered "coming soon"
 * preview when the feature flag (`HABIT_HUB_COMING_SOON`) lists any, and a 'Continue' action to
 * the first not-done exercise. */
@Component({
  selector: 'app-habit-hub-page',
  imports: [MatButtonModule, MatIconModule, MatListModule, RouterLink, TranslocoPipe, AppDatePipe],
  templateUrl: './habit-hub-page.html',
  styleUrl: './habit-hub-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitHubPage {
  private readonly progress = inject(ExerciseProgress);
  private readonly comingSoonRegistry = inject(HABIT_HUB_COMING_SOON);

  /** Route parameter, bound through `withComponentInputBinding`. */
  readonly habit = input.required<string>();

  protected readonly habitDefinition = computed(() => findHabit(this.habit()));

  protected readonly exercises = computed<readonly ExerciseRegistryEntry[]>(() => {
    const habit = this.habit();
    return isHabitId(habit)
      ? getRegisteredExercises().filter((exercise) => exercise.habit === habit)
      : [];
  });

  protected readonly comingSoon = computed<readonly ComingSoonExercise[]>(() => {
    const habit = this.habit();
    return isHabitId(habit) ? this.comingSoonRegistry.filter((entry) => entry.habit === habit) : [];
  });

  protected readonly isEmpty = computed(
    () => this.exercises().length === 0 && this.comingSoon().length === 0,
  );

  protected readonly continueRoute = computed(() =>
    nextExerciseRoute(this.exercises(), (exerciseId) => this.progress.isDone(exerciseId)()),
  );

  protected isDone(exerciseId: string): Signal<boolean> {
    return this.progress.isDone(exerciseId);
  }

  protected completedAt(exerciseId: string): Signal<string | null> {
    return this.progress.completedAt(exerciseId);
  }
}
