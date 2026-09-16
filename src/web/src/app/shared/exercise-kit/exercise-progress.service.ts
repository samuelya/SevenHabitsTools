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

  private readonly isDoneCache = new Map<string, Signal<boolean>>();
  private readonly completedAtCache = new Map<string, Signal<string | null>>();
  private readonly progressForCache = new Map<HabitId, Signal<HabitExerciseProgress>>();

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

  /** One memoized `computed()` per `exerciseId`, reused across calls — callers typically invoke
   * this inline while rendering a list (e.g. `progress.isDone(item.id)()`), so minting a fresh
   * `computed()` every call would defeat memoization and allocate a signal node per render. */
  isDone(exerciseId: string): Signal<boolean> {
    let signal = this.isDoneCache.get(exerciseId);
    if (!signal) {
      signal = computed(() => isExerciseDone(this.completions.value(), exerciseId));
      this.isDoneCache.set(exerciseId, signal);
    }
    return signal;
  }

  completedAt(exerciseId: string): Signal<string | null> {
    let signal = this.completedAtCache.get(exerciseId);
    if (!signal) {
      signal = computed(() => completedAtFor(this.completions.value(), exerciseId));
      this.completedAtCache.set(exerciseId, signal);
    }
    return signal;
  }

  progressFor(habit: HabitId): Signal<HabitExerciseProgress> {
    let signal = this.progressForCache.get(habit);
    if (!signal) {
      signal = computed(() =>
        progressForHabit(this.completions.value(), getRegisteredExercises(), habit),
      );
      this.progressForCache.set(habit, signal);
    }
    return signal;
  }
}
