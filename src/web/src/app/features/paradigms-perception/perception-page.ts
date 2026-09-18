import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { CLOCK } from '../../core/time/clock';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { GuidedStepContent } from '../../shared/exercise-kit/guided-stepper/guided-step-content';
import {
  GuidedStepDefinition,
  GuidedStepper,
} from '../../shared/exercise-kit/guided-stepper/guided-stepper';
import { ReflectionEditor } from '../../shared/exercise-kit/reflection-editor/reflection-editor';
import { PerceptionSummary } from './perception-summary';
import {
  blankChangeAttempts,
  ensureExercise,
  isComplete,
  isStepOneComplete,
  SWITCH_DIFFICULTY_MAX,
  SWITCH_DIFFICULTY_MIN,
  summarize,
  withChain,
  withChainAlt,
  withChangeAttempt,
  withDifference,
  withFirstView,
  withReflection,
  withSwitchDifficulty,
} from './perception.logic';
import {
  CHANGE_ATTEMPT_KINDS,
  ChangeAttemptKind,
  PERCEPTION_MODEL_KEY,
  PerceptionChain,
  PerceptionExercise,
} from './perception.model';

/** `[0]` is the `appGuidedStep` key the template's `<ng-template>`s use; `[1]` is the i18n
 * namespace (`step1`/`step2`/`step3`) their content and this page's own step label live under. */
const STEPS = [
  ['twoViews', 'step1'],
  ['characterOrTechnique', 'step2'],
  ['seeDoGet', 'step3'],
] as const;

/**
 * Paradigms & perception (issue #48): the reference **worksheet** exercise (playbook §4) — a
 * single record created on its first edit, filled through a fixed 3-step `GuidedStepper` with no
 * per-item selection and no focus-mode editor at all (playbook §5's "Worksheet pages" note). The
 * container: it reads `featureStore`, calls `ExerciseProgress`, and passes plain values down to
 * `PerceptionSummary`/`ReflectionEditor`/`DoneToggle` — none of which inject the store or a
 * service. No routing beyond the one fixed path (`perception.routes.ts`): there is nothing to
 * select or deep-link to inside a worksheet.
 */
@Component({
  selector: 'app-perception-page',
  imports: [
    CdkTextareaAutosize,
    DoneToggle,
    ExercisePage,
    ExercisePromptCard,
    GuidedStepContent,
    GuidedStepper,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    PerceptionSummary,
    ReflectionEditor,
    TranslocoPipe,
  ],
  templateUrl: './perception-page.html',
  styleUrl: './perception-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerceptionPage {
  private readonly clock = inject(CLOCK);
  private readonly store = featureStore<PerceptionExercise | null>(PERCEPTION_MODEL_KEY);
  protected readonly progress = inject(ExerciseProgress);

  protected readonly changeAttemptKinds = CHANGE_ATTEMPT_KINDS;
  protected readonly sliderMin = SWITCH_DIFFICULTY_MIN;
  protected readonly sliderMax = SWITCH_DIFFICULTY_MAX;

  protected readonly exercise = computed(() => this.store.value());
  protected readonly changeAttempts = computed(
    () => this.exercise()?.changeAttempts ?? blankChangeAttempts(),
  );
  protected readonly hasFirstView = computed(() => Boolean(this.exercise()?.firstView.trim()));
  /** The slider's own displayed/bound value: `switchDifficulty`'s `0` ("not yet rated") isn't a
   * value a slider bound to `[min]="sliderMin"` (1) can ever show, so this is what both the
   * caption and the slider itself read — never the raw field. */
  protected readonly switchDifficultyDisplay = computed(
    () => this.exercise()?.switchDifficulty || SWITCH_DIFFICULTY_MIN,
  );

  // Step 1's "reveal the alternative view" moment (issue #48's acceptance criteria): a plain
  // local signal, not derived from `exercise()` — every field edit produces a new exercise object
  // (the document store's own immutability), so a `computed`/`linkedSignal` reading the whole
  // record would flip this back to `false` on the very next keystroke in a *later* step, hiding a
  // view the user already revealed. Initialised once below from whatever was already answered on
  // load (a reload or deep link after the user got this far), then only ever set forward.
  protected readonly revealed = signal(false);

  protected readonly selectedIndex = signal(0);

  // `translateSignal`, not `transloco.translate()` read inside a `computed` — see the playbook's
  // "Reactive labels" section for why, and why the scope is passed explicitly (this route also
  // provides `exercise-kit`).
  private readonly stepLabels = translateSignal(
    STEPS.map(([, i18nKey]) => `${i18nKey}.stepLabel`),
    undefined,
    'paradigms-perception',
  );
  protected readonly steps = computed<readonly GuidedStepDefinition[]>(() =>
    STEPS.map(([key], index) => ({ key, label: this.stepLabels()[index] ?? '' })),
  );

  protected readonly summary = computed(() => summarize(this.exercise()));
  protected readonly readyToMarkDone = computed(() => isComplete(this.exercise()));
  protected readonly done = this.progress.isDone(PERCEPTION_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(PERCEPTION_MODEL_KEY);

  constructor() {
    const initial = untracked(this.exercise);
    if (initial && isStepOneComplete(initial)) {
      this.revealed.set(true);
    }
  }

  protected onFirstViewChanged(event: Event): void {
    const firstView = (event.target as HTMLTextAreaElement).value;
    this.updateExercise((exercise) => withFirstView(exercise, firstView, this.clock.now()));
  }

  protected onReveal(): void {
    this.revealed.set(true);
  }

  protected onSwitchDifficultyChanged(value: number): void {
    this.updateExercise((exercise) => withSwitchDifficulty(exercise, value, this.clock.now()));
  }

  protected onAttemptTextChanged(index: number, event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.updateExercise((exercise) =>
      withChangeAttempt(exercise, index, { text }, this.clock.now()),
    );
  }

  protected onAttemptKindChanged(index: number, kind: ChangeAttemptKind): void {
    this.updateExercise((exercise) =>
      withChangeAttempt(exercise, index, { kind }, this.clock.now()),
    );
  }

  protected onDifferenceChanged(event: Event): void {
    const difference = (event.target as HTMLTextAreaElement).value;
    this.updateExercise((exercise) => withDifference(exercise, difference, this.clock.now()));
  }

  protected onChainFieldChanged(field: keyof PerceptionChain, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.updateExercise((exercise) => withChain(exercise, { [field]: value }, this.clock.now()));
  }

  protected onChainAltFieldChanged(field: keyof PerceptionChain, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.updateExercise((exercise) => withChainAlt(exercise, { [field]: value }, this.clock.now()));
  }

  protected onReflectionChanged(reflection: string): void {
    this.updateExercise((exercise) => withReflection(exercise, reflection, this.clock.now()));
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(PERCEPTION_MODEL_KEY);
    } else {
      this.progress.markDone(PERCEPTION_MODEL_KEY);
    }
  }

  private updateExercise(apply: (exercise: PerceptionExercise) => PerceptionExercise): void {
    this.store.update((current) => apply(ensureExercise(current, this.clock.now())));
  }
}
