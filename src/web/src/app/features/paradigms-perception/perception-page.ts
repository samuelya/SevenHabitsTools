import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { translateObjectSignal, translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { featureStore } from '../../core/data/feature-store';
import { HANDSET_QUERY } from '../../core/layout/breakpoints';
import { CLOCK } from '../../core/time/clock';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { ExerciseGuideContent } from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { GuidedStepContent } from '../../shared/exercise-kit/guided-stepper/guided-step-content';
import {
  GuidedStepDefinition,
  GuidedStepper,
} from '../../shared/exercise-kit/guided-stepper/guided-stepper';
import { ReflectionEditor } from '../../shared/exercise-kit/reflection-editor/reflection-editor';
import {
  blankChain,
  blankChangeAttempts,
  ChainKey,
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  doneChecklist,
  ensureExercise,
  isComplete,
  isStarted,
  isStepOneComplete,
  isStepThreeComplete,
  isStepTwoComplete,
  withChainField,
  withChangeAttempt,
  withDifference,
  withFirstView,
  withReflection,
  withSwitchDifficulty,
  withViewBRevealed,
} from './perception.logic';
import {
  CHANGE_ATTEMPT_KINDS,
  ChangeAttemptKind,
  PERCEPTION_MODEL_KEY,
  PerceptionExercise,
  SWITCH_DIFFICULTY_MAX,
  SWITCH_DIFFICULTY_MIN,
} from './perception.model';

/** The two chain sections step 3 renders, in display order, each with its own fixed legend key
 * and the i18n namespace (`current`/`alt`) its own field placeholders live under. */
const CHAIN_SECTIONS: readonly { key: ChainKey; legendKey: string; placeholderKey: string }[] = [
  { key: 'chain', legendKey: 'currentLegend', placeholderKey: 'current' },
  { key: 'chainAlt', legendKey: 'altLegend', placeholderKey: 'alt' },
];

/** `[0]` is the `appGuidedStep` key the template's `<ng-template>`s use; `[1]` is the i18n
 * namespace (`step1`/`step2`/`step3`) their content and this page's own step label live under. */
const STEPS = [
  ['twoViews', 'step1'],
  ['characterOrTechnique', 'step2'],
  ['seeDoGet', 'step3'],
] as const;

/** Each step's own completeness check, in `STEPS`' order — the `GuidedStepDefinition.done` this
 * page reports back to `GuidedStepper` per step (issue #212). */
const STEP_COMPLETE = [isStepOneComplete, isStepTwoComplete, isStepThreeComplete] as const;

/**
 * Paradigms & perception (issue #48, reworked by #212): the reference **worksheet** exercise
 * (playbook §4) — a single record created on its first edit, filled through a fixed 3-step
 * `GuidedStepper` with no per-item selection and no focus-mode editor at all (playbook §5's
 * "Worksheet pages" note). The container: it reads `featureStore`, calls `ExerciseProgress`, and
 * passes plain values down to `ExercisePromptCard`/`ReflectionEditor`/`DoneToggle` — none of which
 * inject the store or a service. No routing beyond the one fixed path (`perception.routes.ts`):
 * there is nothing to select or deep-link to inside a worksheet.
 */
@Component({
  selector: 'app-perception-page',
  imports: [
    AppNumberPipe,
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
    ReflectionEditor,
    TranslocoPipe,
  ],
  templateUrl: './perception-page.html',
  styleUrl: './perception-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerceptionPage {
  private readonly clock = inject(CLOCK);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly store = featureStore<PerceptionExercise | null>(PERCEPTION_MODEL_KEY);
  protected readonly progress = inject(ExerciseProgress);

  protected readonly changeAttemptKinds = CHANGE_ATTEMPT_KINDS;
  protected readonly sliderMin = SWITCH_DIFFICULTY_MIN;
  protected readonly sliderMax = SWITCH_DIFFICULTY_MAX;

  protected readonly exercise = computed(() => this.store.value());
  /** Whether a record exists at all (issue #212's "started" rule): needs no stored flag, since a
   * worksheet record is only ever created on its first edit (`ensureExercise`). */
  protected readonly started = computed(() => isStarted(this.exercise()));
  private readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );
  /** The intro card collapses once started (issue #212's spec), but on a phone it always starts
   * collapsed regardless — the mandated copy alone runs to about 520px expanded at 360px width,
   * which by itself pushes the first field past an 800px viewport (see the comment on the issue).
   * Desktop/tablet keeps the literal `started()`-only rule since there's room for it there. */
  protected readonly collapsedByDefault = computed(() => this.started() || this.handset());
  protected readonly changeAttempts = computed(
    () => this.exercise()?.changeAttempts ?? blankChangeAttempts(),
  );
  protected readonly hasFirstView = computed(() => Boolean(this.exercise()?.firstView.trim()));
  /** Step 1's "show the alternative view" moment: read straight off the record
   * (`viewBRevealed`), not page-local UI state — a plain signal here would desync from what the
   * user actually saw once Angular destroys and recreates this page on navigating away and back
   * (review finding on this PR). */
  protected readonly revealed = computed(() => this.exercise()?.viewBRevealed ?? false);
  /** `switchDifficulty` is `null` until the user actually rates it — never a number the slider
   * could be mistaken for a real answer (its own doc comment in `perception.model.ts`). The
   * slider itself still needs *some* value to draw its thumb at, so this is only for that; the
   * template shows an "unrated" caption instead of a number until `exercise()?.switchDifficulty`
   * is set. */
  protected readonly switchDifficultySliderValue = computed(
    () => this.exercise()?.switchDifficulty ?? SWITCH_DIFFICULTY_MIN,
  );
  protected readonly chainSections = computed(() => {
    const exercise = this.exercise();
    return CHAIN_SECTIONS.map((section) => ({
      ...section,
      chain: exercise?.[section.key] ?? blankChain(),
    }));
  });

  protected readonly selectedIndex = signal(0);

  // `translateSignal`, not `transloco.translate()` read inside a `computed` — see the playbook's
  // "Reactive labels" section for why, and why the scope is passed explicitly (this route also
  // provides `exercise-kit`).
  private readonly stepLabels = translateSignal(
    STEPS.map(([, i18nKey]) => `${i18nKey}.stepLabel`),
    undefined,
    'paradigms-perception',
  );
  protected readonly steps = computed<readonly GuidedStepDefinition[]>(() => {
    const exercise = this.exercise();
    return STEPS.map(([key], index) => ({
      key,
      label: this.stepLabels()[index] ?? '',
      // Never an explicit `false` (`GuidedStepper`'s own doc comment) — only `true` once the step
      // is complete, `undefined` otherwise, so `CdkStep`'s own interacted-based tracking still
      // allows skipping ahead.
      done: exercise !== null && STEP_COMPLETE[index](exercise) ? true : undefined,
    }));
  });

  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'paradigms-perception',
  );
  protected readonly checklist = computed(() =>
    doneChecklist(this.exercise(), checklistLabelsFrom(this.checklistLabels())),
  );

  // The whole `guide` object at once (issue #212's "Data model"), not per-field keys: its shape
  // (an array of How-to steps, an array of example cards) doesn't fit `translateSignal`'s
  // flat-key-list API. Reactive to a language switch the same way `translateSignal` is.
  private readonly guideTranslation = translateObjectSignal(
    'guide',
    undefined,
    'paradigms-perception',
  );
  /** `null` until the scope has actually loaded (review finding on this PR): `translateObjectSignal`
   * starts at `{}`, which the cast alone makes look like real content, so `ExercisePromptCard`'s
   * "Read more" button would appear — and open an empty-looking dialog if tapped — before the
   * scope's `guide` key ever loads. Checking `howTo.length` (always non-empty once loaded, since
   * this exercise's `guide` always has at least one how-to step) also makes the input meaningful
   * for an exercise whose scope has no `guide` key at all. */
  protected readonly guideContent = computed(() => {
    const content = this.guideTranslation() as unknown as ExerciseGuideContent;
    return content.howTo?.length ? content : null;
  });

  protected readonly readyToMarkDone = computed(() => isComplete(this.exercise()));
  protected readonly done = this.progress.isDone(PERCEPTION_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(PERCEPTION_MODEL_KEY);

  protected onFirstViewChanged(event: Event): void {
    const firstView = (event.target as HTMLTextAreaElement).value;
    this.updateExercise((exercise) => withFirstView(exercise, firstView, this.clock.now()));
  }

  protected onReveal(): void {
    this.updateExercise((exercise) => withViewBRevealed(exercise, this.clock.now()));
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

  protected onChainFieldChanged(
    chainKey: ChainKey,
    field: 'see' | 'do' | 'get',
    event: Event,
  ): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.updateExercise((exercise) =>
      withChainField(exercise, chainKey, { [field]: value }, this.clock.now()),
    );
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
