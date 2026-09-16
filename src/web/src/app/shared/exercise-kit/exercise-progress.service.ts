import { Injectable, Signal, computed, inject } from '@angular/core';
import { CLOCK } from '../../core/time/clock';
import { featureStore } from '../../core/data/feature-store';
import { HabitId } from '../../core/habits/habits';
import { ExerciseCompletion, EXERCISE_COMPLETIONS_MODEL_KEY } from './exercise-kit.model';
import { getRegisteredExercises } from './exercise-registry';
import {
  HabitExerciseProgress,
  completedAtFor,
  isExerciseDone,
  progressForHabit,
  reopenCompletion,
  upsertDoneCompletion,
} from './exercise-progress.logic';

/**
 * Reads and writes `shared.exerciseCompletions` (`exercise-kit.model.ts`) through `featureStore()`
 * — the kit's one service, injected by container/feature pages (never by the kit's own
 * presentational components, which take `done`/`completedAt` as `input()`s instead, e.g.
 * `DoneToggle`). Pure calculation lives in `exercise-progress.logic.ts`; this class only wires it
 * to the store and the clock.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseProgress {
  private readonly clock = inject(CLOCK);
  private readonly completions = featureStore<ExerciseCompletion[]>(EXERCISE_COMPLETIONS_MODEL_KEY);

  markDone(exerciseId: string): void {
    this.completions.update((completions) =>
      upsertDoneCompletion(completions, exerciseId, this.clock.now()),
    );
  }

  reopen(exerciseId: string): void {
    this.completions.update((completions) =>
      reopenCompletion(completions, exerciseId, this.clock.now()),
    );
  }

  isDone(exerciseId: string): Signal<boolean> {
    return computed(() => isExerciseDone(this.completions.value(), exerciseId));
  }

  completedAt(exerciseId: string): Signal<string | null> {
    return computed(() => completedAtFor(this.completions.value(), exerciseId));
  }

  progressFor(habit: HabitId): Signal<HabitExerciseProgress> {
    return computed(() =>
      progressForHabit(this.completions.value(), getRegisteredExercises(), habit),
    );
  }
}
