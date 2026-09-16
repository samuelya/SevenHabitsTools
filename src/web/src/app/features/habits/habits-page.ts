import { ChangeDetectionStrategy, Component, Signal, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HABITS, HabitId } from '../../core/habits/habits';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { HabitExerciseProgress } from '../../shared/exercise-kit/exercise-progress.logic';
import { progressPercentage } from './habits.logic';

@Component({
  selector: 'app-habits-page',
  imports: [MatIconModule, MatListModule, MatProgressSpinnerModule, RouterLink, TranslocoPipe],
  templateUrl: './habits-page.html',
  styleUrl: './habits-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitsPage {
  private readonly progress = inject(ExerciseProgress);

  protected readonly habits = HABITS;
  protected readonly progressPercentage = progressPercentage;

  protected progressFor(habit: HabitId): Signal<HabitExerciseProgress> {
    return this.progress.progressFor(habit);
  }
}
