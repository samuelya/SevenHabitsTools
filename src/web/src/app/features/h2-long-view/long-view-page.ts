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
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { AssessmentHistoryList } from '../../shared/exercise-kit/assessment-history-list/assessment-history-list';
import {
  localDateString,
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
import { ReflectionEditor } from '../../shared/exercise-kit/reflection-editor/reflection-editor';
import { LongViewPrompt } from './long-view-prompt';
import { LongViewReadout } from './long-view-readout';
import { LongViewScenarioPicker } from './long-view-scenario-picker';
import { LongViewSummary } from './long-view-summary';
import {
  CHECKLIST_KEYS,
  PROMPTS,
  STEP_KEYS,
  answerFor,
  canMarkDone,
  checklistLabelsFrom,
  checklistLoaded,
  completedScenarios,
  doneChecklist,
  editLongView,
  historyItems,
  isDraftWorthSaving,
  isStarted,
  labelsByKey,
  liveLongViews,
  newLongViewFields,
  removeLongView,
  restoreLongView,
  scenarioValues,
  valuesHeard,
  withAnswer,
} from './long-view.logic';
import {
  LONG_VIEW_MODEL_KEY,
  LONG_VIEW_ROUTE,
  LONG_VIEW_SCENARIOS,
  LongView,
  LongViewAnswer,
  LongViewFields,
  LongViewScenario,
} from './long-view.model';

/** What the editor pane shows for the selected long view. */
type EditorMode = 'pick' | 'edit' | 'read';

/**
 * Your long view (issue #58): an **assessment** exercise (playbook §4), `MaturityPage`'s shell
 * with `PerceptionPage`'s stepper of prompts inside the editor. The container: it reads
 * `featureStore`, calls `ExerciseProgress`, and passes plain values to the presentational parts.
 *
 * "New long view" opens an in-memory draft at `.../new` (`recordDraft()`, issue #217) whose editor
 * first shows the scenario picker; picking fills the draft's answers but stores nothing, and the
 * first typed character, speaker edit or chip stores it (`isDraftWorthSaving()`). A saved long
 * view opens read-only until "Edit". The step index and the edit state are keyed to the selected
 * id, so an autosave never resets them and opening another long view always does.
 */
@Component({
  selector: 'app-long-view-page',
  imports: [
    AssessmentHistoryList,
    DoneToggle,
    ExercisePage,
    ExercisePromptCard,
    GuidedStepContent,
    GuidedStepper,
    LongViewPrompt,
    LongViewReadout,
    LongViewScenarioPicker,
    LongViewSummary,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    ReflectionEditor,
    TranslocoPipe,
  ],
  templateUrl: './long-view-page.html',
  styleUrl: './long-view-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongViewPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<LongView[]>(LONG_VIEW_MODEL_KEY);
  protected readonly progress = inject(ExerciseProgress);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  protected readonly started = computed(() => isStarted(this.store.value()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  protected readonly guideContent = exerciseGuideSignal('h2-long-view');

  private readonly scenarioTitles = translateSignal(
    LONG_VIEW_SCENARIOS.map((scenario) => `scenario.${scenario}.title`),
    undefined,
    'h2-long-view',
  );
  protected readonly scenarioLabels = computed(() =>
    labelsByKey(LONG_VIEW_SCENARIOS, this.scenarioTitles()),
  );
  private readonly stepTitles = translateSignal(
    STEP_KEYS.map((key) => `${key}.stepTitle`),
    undefined,
    'h2-long-view',
  );
  private readonly stepLabels = computed(() => labelsByKey(STEP_KEYS, this.stepTitles()));

  protected readonly views = computed(() => liveLongViews(this.store.value()));
  private readonly history = computed(() => sortedByDateDesc(this.views()));
  protected readonly historyItems = computed(() =>
    historyItems(this.history(), this.scenarioLabels()),
  );

  /** The scenario a Redo opens the next draft on; `null` opens the picker. */
  private pendingScenario: LongViewScenario | null = null;
  /** Whether the open unsaved draft's scenario has been chosen (reset by New, set by Redo). */
  private readonly scenarioChosen = signal(false);

  protected readonly draft = recordDraft<LongView>({
    itemId: this.itemId,
    records: this.views,
    create: () => {
      const now = this.clock.now();
      return newRecord(
        newLongViewFields(this.pendingScenario ?? 'funeral', localDateString(now)),
        now,
      );
    },
    isWorthSaving: (draft) => isDraftWorthSaving(draft),
    save: (record) => this.store.update((list) => [...list, record]),
    update: (id, fields) =>
      this.store.update((list) => editLongView(list, id, fields, this.clock.now())),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });

  private readonly selectedId = computed(() => this.draft.selected()?.id ?? null);
  /** "Edit" on a saved long view; back to read-only whenever another one (or none) is selected. */
  private readonly editing = linkedSignal({ source: this.selectedId, computation: () => false });
  protected readonly stepIndex = linkedSignal({ source: this.selectedId, computation: () => 0 });

  protected readonly mode = computed<EditorMode | null>(() => {
    if (this.draft.selected() === null) {
      return null;
    }
    if (this.draft.unsaved()) {
      return this.scenarioChosen() ? 'edit' : 'pick';
    }
    return this.editing() ? 'edit' : 'read';
  });

  protected readonly editorTitle = computed(() => {
    const view = this.draft.selected();
    return view === null || this.mode() === 'pick' ? '' : this.scenarioLabels()[view.scenario];
  });

  /** The selected long view's answers in prompt order, one per step. */
  protected readonly answers = computed<readonly LongViewAnswer[]>(() => {
    const view = this.draft.selected();
    return view ? PROMPTS[view.scenario].map((key) => answerFor(view, key)) : [];
  });
  protected readonly selectedValues = computed(() => {
    const view = this.draft.selected();
    return view ? scenarioValues(view) : [];
  });
  protected readonly steps = computed(() => {
    const labels = this.stepLabels();
    return [
      ...this.answers().map((answer) => ({
        key: answer.promptKey,
        label: labels[answer.promptKey] ?? '',
        done: answer.text.trim() !== '' ? true : undefined,
      })),
      { key: 'readBack', label: labels['readBack'] ?? '' },
    ];
  });

  /** `null` until a live long view exists (no zero counter, playbook §8). */
  protected readonly summary = computed(() => {
    const list = this.store.value();
    return this.views().length > 0
      ? { values: valuesHeard(list), completed: completedScenarios(list).length }
      : null;
  });
  protected readonly readyToMarkDone = computed(() => canMarkDone(this.store.value()));
  private readonly checklistTranslations = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'h2-long-view',
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistTranslations());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });
  protected readonly done = this.progress.isDone(LONG_VIEW_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(LONG_VIEW_MODEL_KEY);

  /** Set by a pick, Redo or Edit: focus the current prompt once the stepper is on screen. */
  private readonly focusRequested = signal(false);

  constructor() {
    effect(() => {
      if (this.focusRequested() && this.mode() === 'edit') {
        untracked(() => this.focusRequested.set(false));
        afterNextRender(() => this.focusCurrentPrompt(), { injector: this.injector });
      }
    });
  }

  /** Absolute, as `MaturityPage.goTo()` explains. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${LONG_VIEW_ROUTE}`, ...commands], options);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeEditor(): void {
    this.goTo([]);
  }

  /** Opens the picker on an in-memory draft; nothing is stored yet (issue #217). */
  protected onNew(): void {
    this.pendingScenario = null;
    this.scenarioChosen.set(false);
    this.draft.start();
  }

  /** The scenario choice fills the draft's answers in memory; it stores nothing on its own. */
  protected onPicked(scenario: LongViewScenario): void {
    const view = this.draft.selected();
    if (view === null) {
      return;
    }
    this.draft.edit(view.id, newLongViewFields(scenario, view.date));
    this.scenarioChosen.set(true);
    this.focusRequested.set(true);
  }

  /** A new record of the same scenario; the old one stays. */
  protected onRedo(): void {
    const view = this.draft.selected();
    if (view === null) {
      return;
    }
    this.pendingScenario = view.scenario;
    this.scenarioChosen.set(true);
    this.focusRequested.set(true);
    this.draft.start();
  }

  protected onEdit(): void {
    this.editing.set(true);
    this.focusRequested.set(true);
  }

  protected onTextChanged(promptKey: string, text: string): void {
    this.editAnswer(promptKey, { text });
  }

  protected onSpeakerChanged(promptKey: string, speaker: string): void {
    this.editAnswer(promptKey, { speaker });
  }

  protected onValuesChanged(promptKey: string, values: readonly string[]): void {
    this.editAnswer(promptKey, { values });
  }

  /** By id, not the selected view: closing the editor flushes the debounced reflection while it
   * is being removed, after the selection has already gone (playbook §6's flush pitfall). */
  protected onReflectionChanged(id: string, reflection: string, editor: ReflectionEditor): void {
    editor.reportSaveOutcome(this.draft.edit(id, { reflection }));
  }

  private editAnswer(promptKey: string, fields: Partial<Omit<LongViewAnswer, 'promptKey'>>): void {
    const view = this.draft.selected();
    if (view !== null) {
      this.edit({ answers: withAnswer(view, promptKey, fields) });
    }
  }

  /** Every edit goes through the draft: it stores a draft once worth saving (then the URL moves
   * to its id) and keeps the editor in edit mode across that move. */
  private edit(fields: Partial<LongViewFields>): boolean {
    const view = this.draft.selected();
    if (view === null) {
      return false;
    }
    this.editing.set(true);
    return this.draft.edit(view.id, fields);
  }

  protected onDeleted(id: string): void {
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h2LongView.list.deleted'),
      undoLabel: this.transloco.translate('h2LongView.list.undo'),
      onConfirm: () => this.store.update((list) => removeLongView(list, id, this.clock.now())),
      onUndo: () => this.store.update((list) => restoreLongView(list, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(LONG_VIEW_MODEL_KEY);
    } else {
      this.progress.markDone(LONG_VIEW_MODEL_KEY);
    }
  }

  /** The current step's answer field; the closing step has none, so nothing moves. */
  private focusCurrentPrompt(): void {
    const fields = this.host.nativeElement.querySelectorAll<HTMLTextAreaElement>(
      'app-long-view-prompt textarea',
    );
    fields[this.stepIndex()]?.focus();
  }
}
