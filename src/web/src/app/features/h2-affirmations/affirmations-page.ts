import {
  ChangeDetectionStrategy,
  Component,
  ViewContainerRef,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { LanguageStore } from '../../core/i18n/language-store';
import { intlLocaleFor } from '../../core/i18n/locale.logic';
import { AppDialog } from '../../core/layout/app-dialog';
import { AppSnackbar } from '../../core/layout/app-snackbar';
import { CLOCK } from '../../core/time/clock';
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
import { NEW_ITEM_ID, recordDraft } from '../../shared/exercise-kit/record-draft';
import { todaySignal } from '../../shared/exercise-kit/today';
import { AffirmationItemForm } from './affirmation-item-form';
import {
  AffirmationPractice,
  PracticeDialogData,
  PracticeDialogResult,
} from './affirmation-practice';
import { AffirmationsSummary } from './affirmations-summary';
import {
  AffirmationLabels,
  CHECKLIST_KEYS,
  DATE_TOKEN,
  ITEM_TOKEN,
  N_TOKEN,
  TOTAL_TOKEN,
  activeAffirmations,
  affirmationFromExample,
  archivedAffirmations,
  canPractise,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editAffirmation,
  editFields,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  liveSampleOf,
  logPractice,
  practiceLength,
  removeAffirmation,
  restoreAffirmation,
  summarize,
  toListItem,
  uncheckedChecks,
} from './affirmations.logic';
import {
  AFFIRMATIONS_MODEL_KEY,
  AFFIRMATIONS_ROUTE,
  Affirmation,
  AffirmationFields,
} from './affirmations.model';

/**
 * Your affirmations (issue #64): a list exercise copied from `InspirationPage` (routing, draft
 * before record, samples and delete-with-undo work the same way), with an archived group as in
 * `RolesPage` and a practice dialog per row. The container: it reads `featureStore`, opens the
 * dialog and stores what it returns.
 */
@Component({
  selector: 'app-affirmations-page',
  imports: [
    AffirmationItemForm,
    AffirmationsSummary,
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './affirmations-page.html',
  styleUrl: './affirmations-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffirmationsPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly dialog = inject(AppDialog);
  private readonly snackbar = inject(AppSnackbar);
  private readonly languageStore = inject(LanguageStore);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly store = featureStore<readonly Affirmation[]>(AFFIRMATIONS_MODEL_KEY);

  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal(AFFIRMATIONS_MODEL_KEY);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  /** The local date, updated just after midnight ("Practised today", the streak). */
  private readonly today = todaySignal();

  protected readonly started = computed(() => isStarted(this.store.value()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);

  // Labels: `translateSignal` with the scope named, keys relative to it (playbook §6). Tokens stay
  // in the templates and are replaced with formatted numbers and dates per row.
  private readonly exampleLabel = translateSignal(
    'list.example',
    undefined,
    AFFIRMATIONS_MODEL_KEY,
  );
  private readonly practiseLabel = translateSignal(
    'list.practiseButton',
    undefined,
    AFFIRMATIONS_MODEL_KEY,
  );
  private readonly practiseAriaTemplate = translateSignal(
    'list.practiseAria',
    { item: ITEM_TOKEN },
    AFFIRMATIONS_MODEL_KEY,
  );
  private readonly practisedTodayLabel = translateSignal(
    'list.practisedTodayText',
    undefined,
    AFFIRMATIONS_MODEL_KEY,
  );
  private readonly checksTemplate = translateSignal(
    'list.checksText',
    { n: N_TOKEN, total: TOTAL_TOKEN },
    AFFIRMATIONS_MODEL_KEY,
  );
  private readonly lastPractisedTemplate = translateSignal(
    'list.lastPractisedText',
    { date: DATE_TOKEN },
    AFFIRMATIONS_MODEL_KEY,
  );
  private readonly labels = computed<AffirmationLabels>(() => {
    const locale = intlLocaleFor(this.languageStore.language(), this.languageStore.numerals());
    const numbers = new Intl.NumberFormat(locale);
    const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    return {
      example: this.exampleLabel() ?? '',
      practise: this.practiseLabel() ?? '',
      practiseAriaTemplate: this.practiseAriaTemplate() ?? '',
      practisedToday: this.practisedTodayLabel() ?? '',
      checksTemplate: this.checksTemplate() ?? '',
      lastPractisedTemplate: this.lastPractisedTemplate() ?? '',
      formatNumber: (value) => numbers.format(value),
      formatDate: (date) => dates.format(parseIsoDate(date)),
    };
  });

  private readonly list = computed(() => this.store.value());
  private readonly active = computed(() => activeAffirmations(this.list()));
  private readonly live = computed(() => [...this.active(), ...archivedAffirmations(this.list())]);
  protected readonly activeItems = computed(() => this.listItems(this.active()));
  protected readonly archivedItems = computed(() =>
    this.listItems(archivedAffirmations(this.list())),
  );

  protected readonly draft = recordDraft<Affirmation>({
    itemId: this.itemId,
    records: this.live,
    create: () =>
      newRecord<AffirmationFields>(
        { text: '', checks: uncheckedChecks(), practice: [] },
        this.clock.now(),
      ),
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.store.update((list) => [...list, record]),
    update: (id, fields) => this.store.update((list) => editAffirmation(list, id, fields)),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });

  /** Whether the archived group is open, as `RolesPage.archivedExpanded` explains: selecting or
   * archiving an archived affirmation opens it, keyed to the id so an edit doesn't reset it. */
  protected readonly archivedExpanded = linkedSignal<string | null, boolean>({
    source: () => {
      const selected = this.draft.selected();
      return selected?.archived === true ? selected.id : null;
    },
    computation: (archivedId, previous) =>
      archivedId !== null || (previous?.source ?? null) !== null || (previous?.value ?? false),
  });

  protected readonly summary = computed(() => summarize(this.list(), this.today()));
  protected readonly readyToMarkDone = computed(() => isComplete(this.list()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    AFFIRMATIONS_MODEL_KEY,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.list(), labels) : null;
  });

  protected readonly done = this.progress.isDone(AFFIRMATIONS_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(AFFIRMATIONS_MODEL_KEY);

  private listItems(affirmations: readonly Affirmation[]) {
    const today = this.today();
    const labels = this.labels();
    return affirmations.map((affirmation) => toListItem(affirmation, today, labels));
  }

  /** Absolute navigation, for the reason `TransitionPage.goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${AFFIRMATIONS_ROUTE}`, ...commands], options);
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

  protected toggleArchived(): void {
    this.archivedExpanded.update((open) => !open);
  }

  /** "Try this example" (issue #232): a real affirmation flagged `sample`, with no practice log.
   * An untouched one already tried opens instead of a copy. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const fields = affirmationFromExample(sample);
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.list(), fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Affirmation = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.store.update((list) => [...list, record])) {
      this.goTo([record.id], options);
    }
  }

  /** Cleaned before `draft.edit()`: the draft path merges fields as they come (playbook §6). */
  protected onItemChanged(id: string, edit: Partial<AffirmationFields>): void {
    this.draft.edit(id, editFields(edit));
  }

  protected onArchivedChange(id: string, archived: boolean): void {
    this.store.update((list) => editAffirmation(list, id, editFields({ archived })));
  }

  /** The row's Practise button: opens the practice view and logs only what "Done" returns. The
   * dialog restores focus to this button when it closes (`MatDialog`'s `restoreFocus`). */
  protected async onPractise(id: string): Promise<void> {
    const affirmation = this.list().find((candidate) => candidate.id === id);
    if (!affirmation || !canPractise(affirmation)) {
      return;
    }
    const data: PracticeDialogData = {
      text: affirmation.text.trim(),
      ...(affirmation.scene?.trim() ? { scene: affirmation.scene.trim() } : {}),
      length: practiceLength(affirmation),
    };
    const ref = await this.dialog.open<
      AffirmationPractice,
      PracticeDialogData,
      PracticeDialogResult
    >(AffirmationPractice, {
      viewContainerRef: this.viewContainerRef,
      data,
      panelClass: 'affirmation-practice-panel',
      width: '100vw',
      height: '100%',
      maxWidth: '100vw',
      maxHeight: '100vh',
      autoFocus: '.practice-start',
    });
    ref.afterClosed().subscribe((result) => {
      if (result !== undefined) {
        this.logPractice(id, result);
      }
    });
  }

  private logPractice(id: string, result: PracticeDialogResult): void {
    const entry = { date: localDateString(this.clock.now()), seconds: result.seconds };
    const saved = this.store.update((list) => logPractice(list, id, entry, result.length));
    if (saved) {
      void this.snackbar.open(this.transloco.translate('h2Affirmations.practice.loggedText'), '', {
        duration: 3000,
      });
    }
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h2Affirmations.list.deleted'),
      undoLabel: this.transloco.translate('h2Affirmations.list.undo'),
      onConfirm: () => this.store.update((list) => removeAffirmation(list, id, this.clock.now())),
      onUndo: () => this.store.update((list) => restoreAffirmation(list, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(AFFIRMATIONS_MODEL_KEY);
    } else {
      this.progress.markDone(AFFIRMATIONS_MODEL_KEY);
    }
  }
}
