import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  Signal,
  computed,
  inject,
  input,
  runInInjectionContext,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { findHabit, isHabitId } from '../../core/habits/habits';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import {
  ExerciseHubStatus,
  ExerciseRegistryEntry,
  exercisesForHabit,
  getRegisteredExercises,
} from '../../shared/exercise-kit/exercise-registry';
import {
  HubActionEntry,
  getRegisteredHubActions,
} from '../../shared/exercise-kit/hub-action-registry';
import { ComingSoonExercise, HABIT_HUB_COMING_SOON } from './habit-hub-coming-soon';
import { nextExerciseRoute } from './habit-hub.logic';

/** Hub for one habit: lists its registered exercises with progress, an unregistered "coming soon"
 * preview when the feature flag (`HABIT_HUB_COMING_SOON`) lists any, and a 'Continue' action to
 * the first not-done exercise. */
@Component({
  selector: 'app-habit-hub-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    RouterLink,
    TranslocoPipe,
    AppDatePipe,
    AppPluralPipe,
  ],
  templateUrl: './habit-hub-page.html',
  styleUrl: './habit-hub-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitHubPage {
  protected readonly progress = inject(ExerciseProgress);
  private readonly comingSoonRegistry = inject(HABIT_HUB_COMING_SOON);
  private readonly injector = inject(Injector);

  /** Route parameter, bound through `withComponentInputBinding`. */
  readonly habit = input.required<string>();

  protected readonly habitDefinition = computed(() => findHabit(this.habit()));

  protected readonly exercises = computed<readonly ExerciseRegistryEntry[]>(() => {
    const habit = this.habit();
    return isHabitId(habit) ? exercisesForHabit(getRegisteredExercises(), habit) : [];
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

  /** Every hub action (issue #52), shown on every *valid* habit's hub — unlike `exercises()`, not
   * filtered to one habit (an action's target, e.g. "teach this chapter", makes sense from any
   * hub), but still gated on `isHabitId()` like every other member here: an invalid `:habit` never
   * renders a real hub (see `habitDefinition()`), so it shouldn't offer hub actions either. */
  protected readonly hubActions = computed<readonly HubActionEntry[]>(() =>
    isHabitId(this.habit()) ? getRegisteredHubActions() : [],
  );

  /** One memoized `computed()` per action id (same reasoning as `statusFor()`'s own cache below):
   * a template binding calls this on every render, and `habit-hub-page.html`'s `[queryParams]`
   * binding re-runs `Object.is` change detection on whatever this returns — a plain method
   * allocating a fresh object every call would make that binding "change" every check even while
   * the habit hasn't. `computed()` instead returns the same reference until `this.habit()` itself
   * changes (a real possibility: this page's route reuses one instance across `/habits/h1` ->
   * `/habits/h2`). */
  private readonly queryParamsCache = new Map<string, Signal<Record<string, string>>>();

  protected queryParamsFor(action: HubActionEntry): Record<string, string> {
    let params = this.queryParamsCache.get(action.id);
    if (!params) {
      params = computed(() => {
        const habit = this.habit();
        return action.queryParams && isHabitId(habit) ? action.queryParams(habit) : {};
      });
      this.queryParamsCache.set(action.id, params);
    }
    return params();
  }

  /** One memoized status `Signal` per `exerciseId` (same reasoning as `ExerciseProgress`'s own
   * caches): a list row calls this inline on every render, so a fresh `runInInjectionContext()`
   * call each time would mint a new signal node per render instead of reusing one. */
  private readonly statusCache = new Map<string, Signal<ExerciseHubStatus | null>>();

  protected statusFor(entry: ExerciseRegistryEntry): Signal<ExerciseHubStatus | null> | null {
    if (!entry.statusFactory) {
      return null;
    }
    let status = this.statusCache.get(entry.exerciseId);
    if (!status) {
      status = runInInjectionContext(this.injector, entry.statusFactory);
      this.statusCache.set(entry.exerciseId, status);
    }
    return status;
  }
}
