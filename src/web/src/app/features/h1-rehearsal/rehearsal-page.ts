import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { isLive, newRecord } from '../../core/data/record';
import { Numerals } from '../../core/i18n/language';
import { intlLocaleFor } from '../../core/i18n/locale.logic';
import { CLOCK } from '../../core/time/clock';
import { CommitmentsService } from '../../shared/commitments/commitments.service';
import { isValidIsoDate, parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseGuideSample } from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import { exerciseGuideSignal } from '../../shared/exercise-kit/exercise-guide/exercise-guide-signal';
import { ExerciseList } from '../../shared/exercise-kit/exercise-list/exercise-list';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { NEW_ITEM_ID, recordDraft } from '../../shared/exercise-kit/record-draft';
import { todaySignal } from '../../shared/exercise-kit/today';
import { RehearsalItemForm, RehearsalPromise } from './rehearsal-item-form';
import { RehearsalSummary } from './rehearsal-summary';
import {
  CHECKLIST_KEYS,
  ROW_STATUSES,
  RehearsalLabels,
  byDate,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editRehearsal,
  followUpOpen,
  followUpOutcome,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  liveRehearsals,
  liveSampleOf,
  promiseSync,
  rehearsalEdit,
  rehearsalFromExample,
  removeRehearsal,
  restoreRehearsal,
  statusLabelsFrom,
  successRatio,
  toListItem,
} from './rehearsal.logic';
import {
  REHEARSAL_MODEL_KEY,
  REHEARSAL_ROUTE,
  Rehearsal,
  RehearsalFields,
  RehearsalFollowUp,
} from './rehearsal.model';

/** Every new rehearsal's draft starts here; it becomes a record on the first typed text. */
const DEFAULT_FIELDS: RehearsalFields = { trigger: '' };

/** Where the Promises page is mounted. Not imported from `features/h1-commitments/`: a feature
 * never depends on another feature's internals (playbook §6). */
const PROMISES_ROUTE = 'habits/h1/commitments';

/** "Rehearse it" (issue #55): a list exercise copied from `h1-circle`. The container: it reads
 * `featureStore`, calls `ExerciseProgress` and `CommitmentsService`, and passes plain values to
 * `ExerciseList`, `RehearsalItemForm` and `RehearsalSummary`.
 *
 * Routing and draft-before-record are `transition-page.ts`'s: the selected rehearsal is the
 * optional `:itemId` segment, "Add rehearsal" opens `new`, and the record is created on the first
 * typed text. Every edit then keeps the rehearsal's promise in step (`promiseSync()`); the
 * follow-up is stored on its own Save, which also resolves the promise.
 */
@Component({
  selector: 'app-rehearsal-page',
  imports: [
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    RehearsalItemForm,
    RehearsalSummary,
    TranslocoPipe,
  ],
  templateUrl: './rehearsal-page.html',
  styleUrl: './rehearsal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RehearsalPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly commitments = inject(CommitmentsService);
  private readonly store = featureStore<Rehearsal[]>(REHEARSAL_MODEL_KEY);
  private readonly numerals = featureStore<Numerals>('numerals');
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  /** The local date of `CLOCK`, updated at midnight. */
  private readonly today = todaySignal();
  protected readonly started = computed(() => isStarted(this.store.value()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal('h1-rehearsal');

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  // `translateSignal` with the scope named explicitly (playbook §6 "Reactive labels").
  private readonly statusLabels = translateSignal(
    ROW_STATUSES.map((status) => `status.${status}`),
    undefined,
    'h1-rehearsal',
  );
  private readonly exampleLabel = translateSignal('list.example', undefined, 'h1-rehearsal');
  private readonly labels = computed<RehearsalLabels>(() => {
    const format = new Intl.DateTimeFormat(intlLocaleFor(this.lang(), this.numerals.value()), {
      dateStyle: 'medium',
    });
    return {
      status: statusLabelsFrom(this.statusLabels()),
      example: this.exampleLabel(),
      formatDate: (date) => (isValidIsoDate(date) ? format.format(parseIsoDate(date)) : ''),
    };
  });

  protected readonly rehearsals = computed(() => liveRehearsals(this.store.value()));
  protected readonly items = computed(() => {
    const today = this.today();
    return byDate(this.rehearsals()).map((r) => toListItem(r, this.labels(), today));
  });

  protected readonly draft = recordDraft<Rehearsal>({
    itemId: this.itemId,
    records: this.rehearsals,
    create: () => newRecord(DEFAULT_FIELDS, this.clock.now()),
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.store.update((rehearsals) => [...rehearsals, record]),
    update: (id, fields) =>
      this.store.update((rehearsals) => editRehearsal(rehearsals, id, fields)),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });
  protected readonly isNewRehearsal = computed(() => !this.draft.selected()?.trigger.trim());
  /** Afterwards needs a stored record: on an unsaved draft its Save would have nothing to edit. */
  protected readonly followUpOpen = computed(() => {
    const rehearsal = this.draft.selected();
    return rehearsal !== null && !this.draft.unsaved() && followUpOpen(rehearsal, this.today());
  });

  /** The selected rehearsal's live promise (`CommitmentsService.byId`, the #57 contract), `null`
   * without one or once it is deleted. */
  protected readonly promise = computed<RehearsalPromise | null>(() => {
    const id = this.draft.selected()?.commitmentId;
    const commitment = id ? this.commitments.byId(id)() : null;
    return commitment
      ? { status: commitment.status, link: `/${PROMISES_ROUTE}/${commitment.id}` }
      : null;
  });

  /** `null` until a counted rehearsal is followed up: no "0 of 0" card. */
  protected readonly summary = computed(() => {
    const summary = successRatio(this.store.value());
    return summary.count > 0 ? summary : null;
  });
  protected readonly readyToMarkDone = computed(() => isComplete(this.store.value()));

  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'h1-rehearsal',
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });

  protected readonly done = this.progress.isDone(REHEARSAL_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(REHEARSAL_MODEL_KEY);

  /** Absolute navigation, for the reason `transition-page.ts`'s `goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${REHEARSAL_ROUTE}`, ...commands], options);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeDetail(): void {
    this.goTo([]);
  }

  protected onAddRehearsal(): void {
    this.draft.start();
  }

  /** "Try this example" (issue #232): a real record at once, flagged `sample` until its first
   * edit; an example already tried and not yet edited opens that one instead. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const fields = rehearsalFromExample(sample);
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.store.value(), fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Rehearsal = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.store.update((rehearsals) => [...rehearsals, record])) {
      this.goTo([record.id], options);
    }
  }

  /** Applies the edit (the draft's raw merge gets a cleaned date too, `rehearsalEdit()`), then
   * keeps the promise in step with the stored rehearsal. */
  protected onItemChanged(id: string, fields: Partial<RehearsalFields>): void {
    if (this.draft.edit(id, rehearsalEdit(fields))) {
      this.syncPromise(id);
    }
  }

  /** Issue #55's #57 contract: `add` once the promise line and the date are both set, `update`
   * while the promise is open. A new promise's id is stored on the rehearsal, and it is resolved
   * at once when the follow-up was saved before it existed. */
  private syncPromise(id: string): void {
    const rehearsal = this.store.value().find((r) => r.id === id && isLive(r));
    if (!rehearsal) {
      return;
    }
    const commitment = rehearsal.commitmentId
      ? this.commitments.byId(rehearsal.commitmentId)()
      : null;
    const sync = promiseSync(rehearsal, commitment);
    if (sync?.kind === 'add') {
      const commitmentId = this.commitments.add(sync.commitment);
      if (commitmentId !== null) {
        this.store.update((rehearsals) => editRehearsal(rehearsals, id, { commitmentId }));
        if (sync.resolveAs) {
          this.commitments.setStatus(commitmentId, sync.resolveAs);
        }
      }
    } else if (sync?.kind === 'update') {
      this.commitments.update(sync.id, sync.edit);
    }
  }

  /** The follow-up's Save: stores it, then resolves the promise Kept or Broken (a no-op for one
   * already resolved). Nothing reaches #57 before this. */
  protected onFollowUpSaved(id: string, followUp: RehearsalFollowUp): void {
    if (!this.draft.edit(id, { followUp })) {
      return;
    }
    const commitmentId = this.store.value().find((r) => r.id === id)?.commitmentId;
    const outcome = followUpOutcome(followUp);
    if (commitmentId && outcome) {
      this.commitments.setStatus(commitmentId, outcome);
    }
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h1Rehearsal.list.deleted'),
      undoLabel: this.transloco.translate('h1Rehearsal.list.undo'),
      onConfirm: () =>
        this.store.update((rehearsals) => removeRehearsal(rehearsals, id, this.clock.now())),
      onUndo: () =>
        this.store.update((rehearsals) => restoreRehearsal(rehearsals, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(REHEARSAL_MODEL_KEY);
    } else {
      this.progress.markDone(REHEARSAL_MODEL_KEY);
    }
  }
}
