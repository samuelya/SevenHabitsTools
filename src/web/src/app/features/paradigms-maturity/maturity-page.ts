import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { HANDSET_QUERY } from '../../core/layout/breakpoints';
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
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { recordDraft } from '../../shared/exercise-kit/record-draft';
import { MaturityAssessmentForm } from './maturity-assessment-form';
import { restoreArea } from './maturity-areas.logic';
import { MaturityResult } from './maturity-result';
import { MaturitySummary } from './maturity-summary';
import {
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  isComplete,
  editAssessment,
  liveAssessmentsOf,
  removeArea,
  newAssessmentFields,
  overallProfile,
  removeAssessment,
  restoreAssessment,
  summarize,
  isStarted,
  isDraftWorthSaving,
} from './maturity.logic';
import {
  MATURITY_AREA_KEYS,
  MATURITY_LEVELS,
  MATURITY_MODEL_KEY,
  MATURITY_ROUTE,
  MaturityArea,
  MaturityAssessment,
  MaturityAssessmentFields,
  MaturityLevel,
} from './maturity.model';

/**
 * Maturity continuum self-assessment (issue #50): the second **assessment** exercise (playbook
 * §4), reusing `assessment-history.logic.ts` (created by #49). The container: it reads
 * `featureStore`, calls `ExerciseProgress`, and passes plain values down to
 * `AssessmentHistoryList`/`MaturityAssessmentForm`/`MaturityResult`/`MaturitySummary` — none of
 * which inject the store or a service.
 *
 * **Routing**, same pattern issue #187 set for the list type and #49 reused: the selected
 * assessment is the optional trailing URL segment `:itemId` (`maturity.routes.ts`), one route with
 * `optionalParamMatcher`, never a `''`/`':itemId'` sibling pair.
 *
 * **Draft before record (issue #217):** "New assessment" opens the reserved `NEW_ITEM_ID` segment
 * on an in-memory draft (`recordDraft()`), stored when the user continues from the area chips to
 * rating (`isDraftWorthSaving()`, #222 review), after which the URL moves to the real id —
 * `TransitionPage`'s pattern.
 */
@Component({
  selector: 'app-maturity-page',
  imports: [
    AssessmentHistoryList,
    DoneToggle,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    MaturityAssessmentForm,
    MaturityResult,
    MaturitySummary,
    TranslocoPipe,
  ],
  templateUrl: './maturity-page.html',
  styleUrl: './maturity-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaturityPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<MaturityAssessment[]>(MATURITY_MODEL_KEY);
  /** Any live record (issue #216), from the same pure predicate the registry's `isStarted` uses. */
  protected readonly started = computed(() => isStarted(this.store.value()));
  /** Read once by `ExercisePromptCard` at mount: collapsed once started, always on a phone. */
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  protected readonly progress = inject(ExerciseProgress);
  private readonly breakpoints = inject(BreakpointObserver);
  /** Below `HANDSET_QUERY` the form rates one area per screen, above it one panel per area
   * (issue #222). */
  protected readonly handset = toSignal(
    this.breakpoints.observe(HANDSET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(HANDSET_QUERY) },
  );

  /** The `:itemId` route param, bound through `withComponentInputBinding` — absent while the URL
   * has no trailing segment, i.e. while the history, not an assessment, is showing. */
  readonly itemId = input<string | null>(null);

  // Reactive labels (`translateSignal`, not `transloco.translate()` inside a `computed()`) — see
  // the playbook's "Reactive labels" section: a cold load or a language switch must still update
  // `historyItems()`'s subtitle and the built-in area names passed to the form/result views.
  private readonly builtInAreaLabels = translateSignal(
    MATURITY_AREA_KEYS.map((key) => `area.${key}`),
    undefined,
    'paradigms-maturity',
  );
  protected readonly builtInLabels = computed<Record<string, string>>(() =>
    Object.fromEntries(
      MATURITY_AREA_KEYS.map((key, index) => [key, this.builtInAreaLabels()[index] ?? '']),
    ),
  );
  private readonly profileTitles = translateSignal(
    MATURITY_LEVELS.map((level) => `level.${level}.title`),
    undefined,
    'paradigms-maturity',
  );
  protected readonly profileLabels = computed<Record<MaturityLevel, string>>(() => {
    const labels = this.profileTitles();
    return { 1: labels[0] ?? '', 2: labels[1] ?? '', 3: labels[2] ?? '' };
  });

  protected readonly assessments = computed(() => liveAssessmentsOf(this.store.value()));
  protected readonly history = computed(() => sortedByDateDesc(this.assessments()));
  protected readonly historyItems = computed(() => {
    const labels = this.profileLabels();
    return this.history().map((assessment) => {
      const profile = overallProfile(assessment.areas);
      return {
        id: assessment.id,
        date: assessment.date,
        subtitle: profile !== null ? labels[profile] : undefined,
      };
    });
  });
  /** Bumped each time the store refuses an area edit (a read-only tab), so the form drops its own
   * copy of the areas and shows the stored ones again (#222 re-review R2). */
  protected readonly refusedEdits = signal(0);
  /** The draft the user pressed Continue on: `isDraftWorthSaving()`'s signal to store it. */
  private continuedDraftId: string | null = null;
  protected readonly draft = recordDraft<MaturityAssessment>({
    itemId: this.itemId,
    records: this.assessments,
    // Read when the draft opens: the latest assessment's areas, levels unset.
    create: () => {
      const now = this.clock.now();
      return newRecord(newAssessmentFields(this.history(), localDateString(now)), now);
    },
    isWorthSaving: (draft) => isDraftWorthSaving(draft, draft.id === this.continuedDraftId),
    save: (record) => this.store.update((assessments) => [...assessments, record]),
    update: (id, fields) =>
      this.store.update((assessments) => editAssessment(assessments, id, fields)),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });
  /** An unsaved draft is compared with the latest stored assessment, exactly as it will be once
   * saved: it takes part in the lookup as if it were already in the history. */
  protected readonly previous = computed(() => {
    const selected = this.draft.selected();
    if (!selected) {
      return null;
    }
    const assessments = this.draft.unsaved()
      ? [...this.assessments(), selected]
      : this.assessments();
    return previousAssessment(assessments, selected.id);
  });
  /** `null` until the first assessment exists (issue #215): no "0 assessments taken" card next
   * to the history's own empty-state text. */
  protected readonly summary = computed(() =>
    this.assessments().length > 0 ? summarize(this.store.value()) : null,
  );
  protected readonly readyToMarkDone = computed(() => isComplete(this.store.value()));

  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'paradigms-maturity',
  );
  /** `null` until the scope has loaded, so `DoneToggle` never renders a blank row on a cold visit
   * (`perception-page.ts`'s same gate). */
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });

  protected readonly done = this.progress.isDone(MATURITY_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(MATURITY_MODEL_KEY);

  /** Absolute, not relative to `this.route` — see `TransitionPage.goTo()`'s doc comment for why
   * relative navigation doesn't resolve against this feature's lazily mounted route. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${MATURITY_ROUTE}`, ...commands], options);
  }

  private goToList(): void {
    this.goTo([]);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeDetail(): void {
    this.goToList();
  }

  /** Opens the editor on an in-memory draft; nothing is stored yet (issue #217). */
  protected onNewAssessment(): void {
    this.draft.start();
  }

  /** Edits reach the store at once for a saved assessment; a new draft keeps them in memory until
   * Continue. An edit that reached neither is refused, and the form is told so. */
  protected onAssessmentChanged(id: string, fields: Partial<MaturityAssessmentFields>): void {
    if (!this.draft.edit(id, fields) && !this.draft.owns(id)) {
      this.refusedEdits.update((count) => count + 1);
    }
  }

  /** Continue into rating stores a new draft (`recordDraft()`), which then moves the URL to its
   * id; on a saved assessment it changes nothing. */
  protected onAssessmentContinued(id: string): void {
    if (this.draft.owns(id)) {
      this.continuedDraftId = id;
      this.draft.edit(id, {});
    }
  }

  /** Removing an area that holds a level or note: confirm → remove → undo, the shared pattern the
   * assessment delete uses (#222 review), with Undo putting the area back where it was. */
  protected onAreaRemoveRequested(id: string, areaId: string): void {
    const areas = this.areasOf(id);
    const index = areas.findIndex((area) => area.id === areaId);
    if (index === -1) {
      return;
    }
    const removed = areas[index];
    void this.deleteWithUndo.confirmAndDelete({
      confirm: {
        title: this.transloco.translate('paradigmsMaturity.form.removeConfirmTitle'),
        body: this.transloco.translate('paradigmsMaturity.form.removeConfirmBody'),
        confirmLabel: this.transloco.translate('paradigmsMaturity.form.removeConfirmButton'),
      },
      deletedMessage: this.transloco.translate('paradigmsMaturity.form.areaRemoved'),
      undoLabel: this.transloco.translate('paradigmsMaturity.history.undo'),
      onConfirm: () => this.draft.edit(id, { areas: removeArea(this.areasOf(id), areaId) }),
      onUndo: () => this.draft.edit(id, { areas: restoreArea(this.areasOf(id), removed, index) }),
    });
  }

  /** The areas of assessment `id` as they stand now: the open assessment's (`draft.selected()`,
   * stored or draft), else the stored one's, for an Undo tapped after the editor closed. */
  private areasOf(id: string): readonly MaturityArea[] {
    const selected = this.draft.selected();
    if (selected?.id === id) {
      return selected.areas;
    }
    return this.assessments().find((candidate) => candidate.id === id)?.areas ?? [];
  }

  /** Confirm → delete → undo (issue #203's shared pattern, playbook's "Deleting entries"). The
   * `recordDraft()` redirect effect closes the editor once the delete lands, since the id is then no longer
   * a live assessment — this only owns confirm, the tombstone, and Undo. */
  protected onAssessmentDeleted(id: string): void {
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('paradigmsMaturity.history.deleted'),
      undoLabel: this.transloco.translate('paradigmsMaturity.history.undo'),
      onConfirm: () =>
        this.store.update((assessments) => removeAssessment(assessments, id, this.clock.now())),
      onUndo: () =>
        this.store.update((assessments) => restoreAssessment(assessments, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(MATURITY_MODEL_KEY);
    } else {
      this.progress.markDone(MATURITY_MODEL_KEY);
    }
  }
}
