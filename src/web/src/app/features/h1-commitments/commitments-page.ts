import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { Numerals } from '../../core/i18n/language';
import { intlLocaleFor } from '../../core/i18n/locale.logic';
import { CLOCK } from '../../core/time/clock';
import type { CommitmentEdit } from '../../shared/commitments/commitments.logic';
import {
  COMMITMENT_STATUSES,
  Commitment,
  CommitmentFields,
  CommitmentResolution,
} from '../../shared/commitments/commitments.model';
import { CommitmentsService } from '../../shared/commitments/commitments.service';
import { localDateString, parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseGuideSample } from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import { exerciseGuideSignal } from '../../shared/exercise-kit/exercise-guide/exercise-guide-signal';
import { ExerciseList } from '../../shared/exercise-kit/exercise-list/exercise-list';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { NEW_ITEM_ID, recordDraft } from '../../shared/exercise-kit/record-draft';
import { CommitmentsItemForm } from './commitments-item-form';
import { CommitmentsSummary } from './commitments-summary';
import {
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  checklistLoaded,
  COMMITMENT_FILTERS,
  CommitmentFilter,
  CommitmentLabels,
  commitmentFromExample,
  doneChecklist,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  labelsByKey,
  listOrder,
  liveSampleOf,
  matchesFilter,
  SOURCE_TOKEN,
  sourceIds,
  sourceLabel,
  statusLabelsFrom,
  summarize,
  toListItem,
} from './commitments.logic';
import { H1_COMMITMENTS_ID, H1_COMMITMENTS_ROUTE } from './commitments.model';

/** Every new promise's draft (issue #217: saved on the first typed text). */
const DEFAULT_FIELDS: CommitmentFields = { text: '', toWhom: 'self', status: 'open' };

/** Short-title keys of every registered exercise, relative to the `habits` scope: a promise's
 * source may be any of them. Read per page, not at module load, so it never depends on which
 * model files were imported before this one. */
function sourceExercises(): { id: string; route: string; key: string }[] {
  return getRegisteredExercises().map((entry) => ({
    id: entry.exerciseId,
    route: entry.route,
    key: entry.shortTitleKey.replace(/^habits\./, ''),
  }));
}

/**
 * Your promises (issue #57), the reference exercise for Habit 1: a list exercise copied from
 * `paradigms-transition` (routing, draft before record, samples and delete-with-undo work the same
 * way; see `TransitionPage`). The container: it reads promises through `CommitmentsService`, the
 * only writer of `shared.commitments`, and passes plain values down.
 */
@Component({
  selector: 'app-commitments-page',
  imports: [
    CommitmentsItemForm,
    CommitmentsSummary,
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './commitments-page.html',
  styleUrl: './commitments-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitmentsPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly commitments = inject(CommitmentsService);
  private readonly numerals = featureStore<Numerals>('numerals');
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly sourceExercises = sourceExercises();

  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal(H1_COMMITMENTS_ID);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  protected readonly list = this.commitments.all;
  protected readonly started = computed(() => isStarted(this.list()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);

  // Labels: `translateSignal` with the scope named, keys relative to it (playbook §6).
  private readonly statusLabels = translateSignal(
    COMMITMENT_STATUSES.map((status) => `status.${status}`),
    undefined,
    H1_COMMITMENTS_ID,
  );
  private readonly exampleLabel = translateSignal('list.example', undefined, H1_COMMITMENTS_ID);
  private readonly overdueLabel = translateSignal('list.overdue', undefined, H1_COMMITMENTS_ID);
  private readonly sourceTemplate = translateSignal(
    'list.sourceText',
    { exercise: SOURCE_TOKEN },
    H1_COMMITMENTS_ID,
  );
  private readonly sourceTitleList = translateSignal(
    this.sourceExercises.map((exercise) => exercise.key),
    undefined,
    'habits',
  );
  protected readonly sourceTitles = computed(() =>
    labelsByKey(
      this.sourceExercises.map((exercise) => exercise.id),
      this.sourceTitleList(),
    ),
  );
  private readonly labels = computed<CommitmentLabels>(() => {
    const format = new Intl.DateTimeFormat(intlLocaleFor(this.lang(), this.numerals.value()), {
      dateStyle: 'medium',
    });
    return {
      status: statusLabelsFrom(this.statusLabels()),
      example: this.exampleLabel(),
      overdue: this.overdueLabel(),
      sourceTemplate: this.sourceTemplate(),
      sourceTitles: this.sourceTitles(),
      formatDate: (date) => format.format(parseIsoDate(date)),
    };
  });

  protected readonly filters = COMMITMENT_FILTERS;
  protected readonly filter = signal<CommitmentFilter>('all');
  protected readonly sourceFilter = signal<string | null>(null);
  /** The "From" filter's options: shown only once a live promise has a source. */
  protected readonly sources = computed(() => sourceIds(this.list()));

  protected readonly items = computed(() => {
    const today = this.today();
    const filter = this.filter();
    const source = this.sources().includes(this.sourceFilter() ?? '') ? this.sourceFilter() : null;
    return listOrder(this.list().filter((c) => matchesFilter(c, filter, source, today))).map((c) =>
      toListItem(c, this.labels(), today),
    );
  });
  protected readonly emptyKey = computed(() =>
    this.list().length ? 'h1Commitments.list.emptyFilter' : 'h1Commitments.list.empty',
  );

  protected readonly draft = recordDraft<Commitment>({
    itemId: this.itemId,
    records: this.list,
    create: () => newRecord(DEFAULT_FIELDS, this.clock.now()),
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.commitments.insert(record),
    update: (id, fields) => this.commitments.update(id, fields as CommitmentEdit),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });
  protected readonly isNewCommitment = computed(() => !this.draft.selected()?.text.trim());
  /** The open promise's source line and link, `''`/`null` for one made here. */
  protected readonly selectedSource = computed(() => {
    const selected = this.draft.selected();
    if (!selected?.source) {
      return { line: '', route: null };
    }
    const exercise = this.sourceExercises.find((entry) => entry.id === selected.source?.exerciseId);
    return { line: sourceLabel(selected, this.labels()), route: exercise?.route ?? null };
  });

  protected readonly summary = computed(() => summarize(this.list(), this.today()));
  protected readonly readyToMarkDone = computed(() => isComplete(this.list()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    H1_COMMITMENTS_ID,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.list(), labels) : null;
  });

  protected readonly done = this.progress.isDone(H1_COMMITMENTS_ID);
  protected readonly completedAt = this.progress.completedAt(H1_COMMITMENTS_ID);

  /** The local date of `CLOCK` now. */
  private today(): string {
    return localDateString(this.clock.now());
  }

  /** Absolute navigation, for the reason `TransitionPage.goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${H1_COMMITMENTS_ROUTE}`, ...commands], options);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeDetail(): void {
    this.goTo([]);
  }

  protected onAdd(): void {
    this.draft.start();
  }

  /** Single-select chips: deselecting the current chip leaves no value, which means "All". */
  protected onFilterChange(event: MatChipListboxChange): void {
    this.filter.set((event.value as CommitmentFilter | undefined) ?? 'all');
  }

  protected onSourceFilterChange(event: MatChipListboxChange): void {
    this.sourceFilter.set((event.value as string | undefined) ?? null);
  }

  /** "Try this example" (issue #232): a real open promise flagged `sample`, due three days from
   * today (issue #57, computed now, never a stored date). An untouched one already tried opens
   * instead of a copy. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const fields = commitmentFromExample(sample, this.today());
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.list(), fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Commitment = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.commitments.insert(record)) {
      this.goTo([record.id], options);
    }
  }

  /** A cleared due date or name is removed rather than stored as `''`. */
  protected onItemChanged(id: string, edit: CommitmentEdit): void {
    const fields: Partial<Commitment> = Object.fromEntries(
      Object.entries(edit).map(([key, value]) => [
        key,
        value === '' && key !== 'text' ? undefined : value,
      ]),
    );
    this.draft.edit(id, fields);
  }

  protected onResolved(id: string, status: CommitmentResolution): void {
    this.commitments.setStatus(id, status);
  }

  protected onReopened(id: string): void {
    this.commitments.reopen(id);
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h1Commitments.list.deleted'),
      undoLabel: this.transloco.translate('h1Commitments.list.undo'),
      onConfirm: () => this.commitments.remove(id),
      onUndo: () => this.commitments.restore(id),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(H1_COMMITMENTS_ID);
    } else {
      this.progress.markDone(H1_COMMITMENTS_ID);
    }
  }
}
