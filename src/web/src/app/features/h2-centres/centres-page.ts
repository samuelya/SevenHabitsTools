import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { AssessmentHistoryList } from '../../shared/exercise-kit/assessment-history-list/assessment-history-list';
import {
  localDateString,
  previousAssessment,
  sortedByDateDesc,
} from '../../shared/exercise-kit/assessment-history.logic';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { exerciseGuideSignal } from '../../shared/exercise-kit/exercise-guide/exercise-guide-signal';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { GuidedStepper } from '../../shared/exercise-kit/guided-stepper/guided-stepper';
import { GuidedStepContent } from '../../shared/exercise-kit/guided-stepper/guided-step-content';
import { recordDraft } from '../../shared/exercise-kit/record-draft';
import { CentreCard } from './centre-card';
import { CentresFactors, FactorChange, TiedCentre } from './centres-factors';
import { CentresPrinciples } from './centres-principles';
import { CentresResult } from './centres-result';
import {
  CENTRE_KEYS,
  CHECKLIST_KEYS,
  PRINCIPLE_KEYS,
  canMarkDone,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editAssessment,
  historyItems,
  isDraftWorthSaving,
  isStarted,
  labelsByKey,
  liveCentreAssessments,
  newAssessmentFields,
  factorsFor,
  chosenCentre,
  ratedValue,
  removeAssessment,
  restoreAssessment,
  topCentres,
  validPrinciples,
  withFactor,
  withFactorsCentre,
  withRating,
} from './centres.logic';
import {
  CENTRES_MODEL_KEY,
  CENTRES_ROUTE,
  CentreAssessment,
  CentreAssessmentFields,
  CentreKey,
  CentrePrinciple,
  CentreRating,
} from './centres.model';

/** What the editor pane shows for the selected assessment. */
type EditorMode = 'edit' | 'read';

/** Where focus goes once the editor pane has swapped its content. */
type FocusTarget = 'step' | 'result';

const STEP_KEYS = ['step1', 'step2', 'step3'] as const;

/**
 * Your centre (issue #60): an **assessment** exercise (playbook §4) on `LongViewPage`'s shell
 * (#58). The container: it reads `featureStore`, calls `ExerciseProgress`, and passes plain values
 * to the presentational parts.
 *
 * "New assessment" opens an in-memory draft at `.../new` (`recordDraft()`, issue #217) on a
 * three-step stepper; the first rating stores it (`isDraftWorthSaving()`). "Save" shows the
 * read-only result, and a saved assessment opens on it until "Edit". The step index and the edit
 * state are keyed to the selected id, so an autosave never resets them and opening another
 * assessment always does.
 */
@Component({
  selector: 'app-centres-page',
  imports: [
    AssessmentHistoryList,
    CentreCard,
    CentresFactors,
    CentresPrinciples,
    CentresResult,
    DoneToggle,
    ExercisePage,
    ExercisePromptCard,
    GuidedStepContent,
    GuidedStepper,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './centres-page.html',
  styleUrl: './centres-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentresPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<CentreAssessment[]>(CENTRES_MODEL_KEY);
  protected readonly progress = inject(ExerciseProgress);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  protected readonly centres = CENTRE_KEYS;
  protected readonly started = computed(() => isStarted(this.store.value()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  protected readonly guideContent = exerciseGuideSignal('h2-centres');

  private readonly centreTitles = translateSignal(
    CENTRE_KEYS.map((centre) => `centre.${centre}.title`),
    undefined,
    'h2-centres',
  );
  protected readonly centreLabels = computed(() => labelsByKey(CENTRE_KEYS, this.centreTitles()));
  private readonly principleTitles = translateSignal(
    PRINCIPLE_KEYS.map((key) => `principle.${key}`),
    undefined,
    'exercise-kit',
  );
  protected readonly principleLabels = computed(() =>
    labelsByKey(PRINCIPLE_KEYS, this.principleTitles()),
  );
  private readonly stepTitles = translateSignal(
    STEP_KEYS.map((key) => `${key}.stepTitle`),
    undefined,
    'h2-centres',
  );
  /** "Centre: Work" per centre. Recomputed whenever the centre titles re-emit (scope loaded or
   * language switched), so `translate()` here never runs before the scope is in. */
  private readonly topCentreLabels = computed(() => {
    const labels = this.centreLabels();
    return labelsByKey(
      CENTRE_KEYS,
      CENTRE_KEYS.map((centre) =>
        labels[centre] === ''
          ? ''
          : this.transloco.translate('h2Centres.list.topCentreText', { centre: labels[centre] }),
      ),
    );
  });

  protected readonly assessments = computed(() => liveCentreAssessments(this.store.value()));
  private readonly history = computed(() => sortedByDateDesc(this.assessments()));
  protected readonly historyItems = computed(() =>
    historyItems(this.history(), this.topCentreLabels()),
  );

  protected readonly draft = recordDraft<CentreAssessment>({
    itemId: this.itemId,
    records: this.assessments,
    create: () => {
      const now = this.clock.now();
      return newRecord(newAssessmentFields(localDateString(now)), now);
    },
    isWorthSaving: (draft) => isDraftWorthSaving(draft),
    save: (record) => this.store.update((list) => [...list, record]),
    update: (id, fields) =>
      this.store.update((list) => editAssessment(list, id, fields, this.clock.now())),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });

  private readonly selectedId = computed(() => this.draft.selected()?.id ?? null);
  /** "Edit" on a saved assessment; back to the result whenever another one (or none) is selected. */
  private readonly editing = linkedSignal({ source: this.selectedId, computation: () => false });
  protected readonly stepIndex = linkedSignal({ source: this.selectedId, computation: () => 0 });

  protected readonly mode = computed<EditorMode | null>(() => {
    if (this.draft.selected() === null) {
      return null;
    }
    return this.draft.unsaved() || this.editing() ? 'edit' : 'read';
  });

  protected readonly steps = computed(() => {
    const labels = this.stepTitles();
    return STEP_KEYS.map((key, index) => ({ key, label: labels[index] ?? '' }));
  });

  /** The centre the selected assessment's factors are about (`chosenCentre()`). */
  protected readonly chosen = computed(() => {
    const assessment = this.draft.selected();
    return assessment === null ? null : chosenCentre(assessment);
  });
  protected readonly chosenLabel = computed(() => {
    const centre = this.chosen();
    return centre === null ? null : this.centreLabels()[centre];
  });
  /** Every centre sharing the top rating, translated. */
  protected readonly tied = computed<readonly TiedCentre[]>(() => {
    const assessment = this.draft.selected();
    const labels = this.centreLabels();
    return assessment === null
      ? []
      : topCentres(assessment).map((centre) => ({ centre, label: labels[centre] }));
  });
  /** "Work and Money": re-read whenever the labels re-emit (scope loaded or language switched). */
  protected readonly tiedList = computed(() => {
    const labels = this.tied().map((entry) => entry.label);
    return labels.length > 1
      ? new Intl.ListFormat(this.transloco.getActiveLang(), { type: 'conjunction' }).format(labels)
      : '';
  });
  /** The factors written about the chosen centre, none when written about another. */
  protected readonly chosenFactors = computed(() => {
    const assessment = this.draft.selected();
    return assessment === null ? undefined : factorsFor(assessment, this.chosen());
  });
  protected readonly principles = computed(() => {
    const assessment = this.draft.selected();
    return assessment === null ? [] : validPrinciples(assessment);
  });

  /** "New assessment" until stored, then "Centre: Work" (the history row's own title). */
  protected readonly editorTitle = computed(() => {
    const assessment = this.draft.selected();
    const centre = assessment === null || this.draft.unsaved() ? null : chosenCentre(assessment);
    return centre === null ? null : this.topCentreLabels()[centre];
  });

  protected readonly previous = computed(() => {
    const id = this.selectedId();
    return id === null ? null : previousAssessment(this.store.value(), id);
  });

  protected readonly readyToMarkDone = computed(() => canMarkDone(this.store.value()));
  private readonly checklistTranslations = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'h2-centres',
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistTranslations());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });
  protected readonly done = this.progress.isDone(CENTRES_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(CENTRES_MODEL_KEY);

  /** Set by Save or Edit: the control that had focus is gone once the pane swaps its content. */
  private readonly focusRequested = signal<FocusTarget | null>(null);

  constructor() {
    effect(() => {
      const target = this.focusRequested();
      const mode = this.mode();
      if (target !== null && mode === (target === 'result' ? 'read' : 'edit')) {
        untracked(() => this.focusRequested.set(null));
        afterNextRender(() => this.moveFocus(target), { injector: this.injector });
      }
    });
  }

  /** Absolute, as `MaturityPage.goTo()` explains. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${CENTRES_ROUTE}`, ...commands], options);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeEditor(): void {
    this.goTo([]);
  }

  /** Opens the stepper on an in-memory draft; nothing is stored yet (issue #217). */
  protected onNew(): void {
    this.draft.start();
  }

  protected storedRating(assessment: CentreAssessment, centre: CentreKey): CentreRating | null {
    return ratedValue(assessment, centre);
  }

  protected onRated(centre: CentreKey, rating: CentreRating): void {
    const assessment = this.draft.selected();
    if (assessment !== null) {
      this.edit({ ratings: withRating(assessment, centre, rating) });
    }
  }

  protected onFactorChanged(change: FactorChange): void {
    const assessment = this.draft.selected();
    if (assessment !== null) {
      this.edit(withFactor(assessment, change.factor, change.text));
    }
  }

  protected onFactorsCentreChanged(centre: CentreKey): void {
    const assessment = this.draft.selected();
    const fields = assessment === null ? null : withFactorsCentre(assessment, centre);
    if (fields !== null) {
      this.edit(fields);
    }
  }

  protected onPrinciplesChanged(principles: readonly CentrePrinciple[]): void {
    this.edit({ principles });
  }

  /** The result view; an untouched draft has none, so Save discards it (nothing stored, and
   * `replaceUrl` keeps Back from reopening it). */
  protected onSave(): void {
    if (this.draft.unsaved()) {
      this.draft.discard();
      return;
    }
    this.editing.set(false);
    this.focusRequested.set('result');
  }

  protected onEdit(): void {
    this.editing.set(true);
    this.focusRequested.set('step');
  }

  /** Every edit goes through the draft: it stores a draft once worth saving (then the URL moves
   * to its id) and keeps the editor in edit mode across that move. */
  private edit(fields: Partial<CentreAssessmentFields>): void {
    const assessment = this.draft.selected();
    if (assessment === null) {
      return;
    }
    this.editing.set(true);
    this.draft.edit(assessment.id, fields);
  }

  protected onDeleted(id: string): void {
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h2Centres.list.deleted'),
      undoLabel: this.transloco.translate('h2Centres.list.undo'),
      onConfirm: () => this.store.update((list) => removeAssessment(list, id, this.clock.now())),
      onUndo: () => this.store.update((list) => restoreAssessment(list, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(CENTRES_MODEL_KEY);
    } else {
      this.progress.markDone(CENTRES_MODEL_KEY);
    }
  }

  private moveFocus(target: FocusTarget): void {
    const root = this.host.nativeElement;
    if (target === 'result') {
      root.querySelector<HTMLElement>('app-centres-result .result-heading')?.focus();
      return;
    }
    const step = root.querySelectorAll<HTMLElement>('.step-body')[this.stepIndex()];
    step?.querySelector<HTMLElement>('button:not([disabled]), textarea, input')?.focus();
  }
}
