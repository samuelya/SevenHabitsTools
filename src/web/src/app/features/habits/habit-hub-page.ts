import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  Signal,
  TemplateRef,
  ViewContainerRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { HabitId, findHabit, isHabitId } from '../../core/habits/habits';
import { ExerciseGuideOpener } from '../../shared/exercise-kit/exercise-guide/exercise-guide-opener';
import { exerciseStatusSignal } from '../../shared/exercise-kit/exercise-hub-status';
import { nextExercise } from '../../shared/exercise-kit/exercise-progress.logic';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import {
  ExerciseRegistryEntry,
  exercisesForHabit,
  getRegisteredExercises,
} from '../../shared/exercise-kit/exercise-registry';
import { exerciseStartedSignal } from '../../shared/exercise-kit/exercise-started';
import {
  HubActionEntry,
  getRegisteredHubActions,
} from '../../shared/exercise-kit/hub-action-registry';
import { ComingSoonExercise, HABIT_HUB_COMING_SOON } from './habit-hub-coming-soon';
import { HubRowStatus, hubRowStatus } from './habit-hub.logic';

/** Hub for one habit (issue #219): its long title with an "About this habit" dialog, a 'Continue'
 * action to the first not-done exercise, the exercises in chapter order with a status column, an
 * unregistered "coming soon" preview when the feature flag (`HABIT_HUB_COMING_SOON`) lists any, and
 * the hub actions ("Teach this chapter") last. */
@Component({
  selector: 'app-habit-hub-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    NgTemplateOutlet,
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
  private readonly guideOpener = inject(ExerciseGuideOpener);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly transloco = inject(TranslocoService);

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

  protected readonly continueTarget = computed(() =>
    nextExercise(this.exercises(), (exerciseId) => this.progress.isDone(exerciseId)()),
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

  /** One memoized row status per `exerciseId` (same reasoning as `ExerciseProgress`'s own caches):
   * a list row reads this inline on every render, so a fresh factory call each time would mint new
   * signal nodes per render instead of reusing one. */
  private readonly rowStatusCache = new Map<string, Signal<HubRowStatus>>();

  protected rowStatusFor(entry: ExerciseRegistryEntry): HubRowStatus {
    let status = this.rowStatusCache.get(entry.exerciseId);
    if (!status) {
      const started = exerciseStartedSignal(entry, this.injector);
      const exerciseStatus = exerciseStatusSignal(entry, this.injector);
      const done = this.progress.isDone(entry.exerciseId);
      const completedAt = this.progress.completedAt(entry.exerciseId);
      status = computed(() => hubRowStatus(done(), completedAt(), started(), exerciseStatus()));
      this.rowStatusCache.set(entry.exerciseId, status);
    }
    return status();
  }

  /** This page's own "About this habit" section (#230), handed to the guide dialog as its `extra`
   * template so the list reuses this page's status renderer and stays live while open. */
  private readonly aboutExercises = viewChild.required<TemplateRef<unknown>>('aboutExercises');

  /** "About this habit" (issues #219, #230) in the exercise guide dialog: In short
   * (`habits.about.<habit>.inShort`), then the habit's exercises in order with their status. */
  protected openAbout(habit: HabitId): void {
    void this.guideOpener.open(
      {
        inShort: this.transloco.translate(`habits.about.${habit}.inShort`),
        howTo: [],
        examples: [],
        afterwards: '',
      },
      this.viewContainerRef,
      {
        title: this.transloco.translate('habits.hub.aboutHabit'),
        extra: this.aboutExercises(),
      },
    );
  }
}
