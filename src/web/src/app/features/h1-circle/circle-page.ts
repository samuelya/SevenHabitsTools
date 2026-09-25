import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { CommitmentsService } from '../../shared/commitments/commitments.service';
import {
  isValidIsoDate,
  localDateString,
} from '../../shared/exercise-kit/assessment-history.logic';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseGuideSample } from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import { ExerciseList } from '../../shared/exercise-kit/exercise-list/exercise-list';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { exerciseGuideSignal } from '../../shared/exercise-kit/exercise-guide/exercise-guide-signal';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { NEW_ITEM_ID, recordDraft } from '../../shared/exercise-kit/record-draft';
import { CircleItemForm, ConcernPromise } from './circle-item-form';
import { CircleSummary } from './circle-summary';
import {
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  checklistLoaded,
  concernEdit,
  concernFromExample,
  doneChecklist,
  editConcern,
  groupConcerns,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  labelsFrom,
  liveConcerns,
  liveSampleOf,
  removeConcern,
  restoreConcern,
  summarize,
  toListItem,
} from './circle.logic';
import {
  CIRCLE_MODEL_KEY,
  CIRCLE_ROUTE,
  CONCERN_CONTROLS,
  CONCERN_STATUSES,
  Concern,
  ConcernFields,
} from './circle.model';

/** Every new concern's draft starts here; it becomes a record on the first typed text. */
const DEFAULT_FIELDS: ConcernFields = {
  title: '',
  control: 'direct',
  status: 'open',
};

/** Where the Promises page is mounted. Not imported from `features/h1-commitments/`: a feature
 * never depends on another feature's internals (playbook §6). */
const PROMISES_ROUTE = 'habits/h1/commitments';

/** "Your influence" (issue #53): a list exercise copied from `paradigms-transition`. The
 * container: it reads `featureStore`, calls `ExerciseProgress` and `CommitmentsService`, and passes
 * plain values to the two `ExerciseList`s, `CircleItemForm` and `CircleSummary`.
 *
 * The list is two `ExerciseList` instances, "Things you can affect" then "Things you can't
 * control", each under its own heading and without search (lead decision on #53). A group with no
 * items renders nothing; with no concerns at all, one list shows the empty state.
 *
 * Routing and draft-before-record are `transition-page.ts`'s: the selected concern is the optional
 * `:itemId` segment, "Add concern" opens `new`, and the record is created on the first typed text.
 */
@Component({
  selector: 'app-circle-page',
  imports: [
    CircleItemForm,
    CircleSummary,
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './circle-page.html',
  styleUrl: './circle-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CirclePage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly commitments = inject(CommitmentsService);
  private readonly store = featureStore<Concern[]>(CIRCLE_MODEL_KEY);
  protected readonly started = computed(() => isStarted(this.store.value()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal('h1-circle');

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  // `translateSignal` with the scope named explicitly (playbook §6 "Reactive labels").
  private readonly controlLabels = translateSignal(
    CONCERN_CONTROLS.map((control) => `control.${control}`),
    undefined,
    'h1-circle',
  );
  private readonly statusLabels = translateSignal(
    CONCERN_STATUSES.map((status) => `status.${status}`),
    undefined,
    'h1-circle',
  );
  private readonly exampleLabel = translateSignal('list.example', undefined, 'h1-circle');
  private readonly labels = computed(() =>
    labelsFrom(this.controlLabels(), this.statusLabels(), this.exampleLabel()),
  );

  protected readonly concerns = computed(() => liveConcerns(this.store.value()));
  private readonly groups = computed(() => groupConcerns(this.concerns()));
  protected readonly affectItems = computed(() =>
    this.groups().affect.map((concern) => toListItem(concern, this.labels())),
  );
  protected readonly cannotControlItems = computed(() =>
    this.groups().cannotControl.map((concern) => toListItem(concern, this.labels())),
  );

  protected readonly draft = recordDraft<Concern>({
    itemId: this.itemId,
    records: this.concerns,
    create: () => newRecord(DEFAULT_FIELDS, this.clock.now()),
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.store.update((concerns) => [...concerns, record]),
    update: (id, fields) => this.store.update((concerns) => editConcern(concerns, id, fields)),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });
  protected readonly isNewConcern = computed(() => !this.draft.selected()?.title.trim());

  /** The selected concern's live promise (`CommitmentsService.byId`, the #57 contract), `null`
   * without one or once it is deleted. */
  protected readonly promise = computed<ConcernPromise | null>(() => {
    const id = this.draft.selected()?.commitmentId;
    const commitment = id ? this.commitments.byId(id)() : null;
    return commitment
      ? { status: commitment.status, link: `/${PROMISES_ROUTE}/${commitment.id}` }
      : null;
  });

  /** `null` until a counted concern you can affect exists: no "0 of 0" card. */
  protected readonly summary = computed(() => {
    const summary = summarize(this.store.value());
    return summary.total > 0 ? summary : null;
  });
  protected readonly readyToMarkDone = computed(() => isComplete(this.store.value()));

  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'h1-circle',
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });

  protected readonly done = this.progress.isDone(CIRCLE_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(CIRCLE_MODEL_KEY);

  /** Absolute navigation, for the reason `transition-page.ts`'s `goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${CIRCLE_ROUTE}`, ...commands], options);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeDetail(): void {
    this.goTo([]);
  }

  protected onAddConcern(): void {
    this.draft.start();
  }

  /** "Try this example" (issue #232): a real record at once, flagged `sample` until its first
   * edit; an example already tried and not yet edited opens that one instead. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const fields = concernFromExample(sample, localDateString(this.clock.now()));
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.store.value(), fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Concern = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.store.update((concerns) => [...concerns, record])) {
      this.goTo([record.id], options);
    }
  }

  protected onItemChanged(id: string, fields: Partial<ConcernFields>): void {
    this.draft.edit(id, concernEdit(fields));
  }

  /** "Make it a promise" (issue #53): makes a promise to self from the first step through the
   * #57 contract and links it back with `commitmentId`. The promise's status never changes the
   * concern's; the user marks Step taken themselves. */
  protected onPromiseRequested(concern: Concern): void {
    const text = concern.firstStep?.trim();
    if (!text) {
      return;
    }
    const dueDate =
      concern.dueDate && isValidIsoDate(concern.dueDate) ? { dueDate: concern.dueDate } : {};
    const commitmentId = this.commitments.add({
      text,
      toWhom: 'self',
      ...dueDate,
      source: { exerciseId: CIRCLE_MODEL_KEY, recordId: concern.id },
    });
    if (commitmentId !== null) {
      this.store.update((concerns) => editConcern(concerns, concern.id, { commitmentId }));
    }
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h1Circle.list.deleted'),
      undoLabel: this.transloco.translate('h1Circle.list.undo'),
      onConfirm: () =>
        this.store.update((concerns) => removeConcern(concerns, id, this.clock.now())),
      onUndo: () => this.store.update((concerns) => restoreConcern(concerns, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(CIRCLE_MODEL_KEY);
    } else {
      this.progress.markDone(CIRCLE_MODEL_KEY);
    }
  }
}
