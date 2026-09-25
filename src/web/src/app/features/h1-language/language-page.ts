import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { Numerals } from '../../core/i18n/language';
import { intlLocaleFor } from '../../core/i18n/locale.logic';
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
import { LanguageDay } from './language-day';
import { LanguageItemForm } from './language-item-form';
import { LanguageWeek, WeekRow } from './language-week';
import {
  CHECKLIST_KEYS,
  PhraseLabels,
  checklistLabelsFrom,
  checklistLoaded,
  countedPhrases,
  dayState,
  daySummary,
  doneChecklist,
  editPhrase,
  endDay,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  kindLabelsFrom,
  livePhrases,
  liveSampleOf,
  perDay,
  phraseEdit,
  phraseFromExample,
  phraseToSave,
  removePhrase,
  restorePhrase,
  runningDay,
  startDay,
  streak,
  toListItem,
} from './language.logic';
import {
  LANGUAGE_MODEL_KEY,
  LANGUAGE_ROUTE,
  LanguageLog,
  PHRASE_KINDS,
  Phrase,
  PhraseFields,
} from './language.model';
import { minuteClock } from './minute-clock';

/** Every new phrase's draft starts here; it becomes a record on the first typed character. */
const DEFAULT_FIELDS: PhraseFields = { text: '', kind: 'reactive' };

/** "Your words" (issue #54): a list exercise copied from `paradigms-transition`, plus the
 * listening day above the list and the last 7 days in the footer. The container: it reads
 * `featureStore` (one key holding `{ phrases, listeningDays }`, lead decision on #54), calls
 * `ExerciseProgress`, and passes plain values to `LanguageDay`, `ExerciseList`, `LanguageItemForm`
 * and `LanguageWeek`.
 *
 * Time: every rule that depends on the clock reads `now`, `CLOCK` re-read once a minute and when
 * the tab becomes visible (`minuteClock()`), so a day reaching its 24 hours ends on screen within
 * a minute, or at once on return to a hidden tab, without anything being stored.
 *
 * Routing and draft-before-record are `transition-page.ts`'s: the selected phrase is the optional
 * `:itemId` segment, "Add phrase" opens `new`, and the record is created on the first typed text.
 */
@Component({
  selector: 'app-language-page',
  imports: [
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    LanguageDay,
    LanguageItemForm,
    LanguageWeek,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './language-page.html',
  styleUrl: './language-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguagePage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<LanguageLog>(LANGUAGE_MODEL_KEY);
  private readonly numerals = featureStore<Numerals>('numerals');
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  private readonly clockTick = minuteClock();
  private readonly now = this.clockTick.now;
  private readonly today = computed(() => localDateString(this.now()));
  protected readonly started = computed(() => isStarted(this.store.value()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal('h1-language');

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  // `translateSignal` with the scope named explicitly (playbook §6 "Reactive labels").
  private readonly kindLabels = translateSignal(
    PHRASE_KINDS.map((kind) => `kind.${kind}`),
    undefined,
    'h1-language',
  );
  private readonly exampleLabel = translateSignal('list.example', undefined, 'h1-language');
  private readonly locale = computed(() => intlLocaleFor(this.lang(), this.numerals.value()));
  private readonly labels = computed<PhraseLabels>(() => {
    const format = new Intl.DateTimeFormat(this.locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return {
      kind: kindLabelsFrom(this.kindLabels()),
      example: this.exampleLabel(),
      formatTime: (iso) => format.format(new Date(iso)),
    };
  });

  protected readonly phrases = computed(() => livePhrases(this.store.value().phrases));
  /** Newest first: the phrase just caught is the one the user looks for. */
  protected readonly items = computed(() =>
    [...this.phrases()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((phrase) => toListItem(phrase, this.labels())),
  );

  protected readonly day = computed(() => dayState(this.store.value().listeningDays, this.now()));
  protected readonly daySummary = computed(() => {
    const state = this.day();
    return state.kind === 'ended' ? daySummary(this.store.value().phrases, state.day.id) : null;
  });

  protected readonly draft = recordDraft<Phrase>({
    itemId: this.itemId,
    records: this.phrases,
    create: () => newRecord(DEFAULT_FIELDS, this.clock.now()),
    isWorthSaving: isDraftWorthSaving,
    // Stamped with the day running when the record is created, read from the clock itself rather
    // than the minute signal.
    save: (record) =>
      this.store.update((log) => ({
        ...log,
        phrases: [
          ...log.phrases,
          phraseToSave(record, runningDay(log.listeningDays, this.clock.now())),
        ],
      })),
    update: (id, fields) =>
      this.store.update((log) => ({
        ...log,
        phrases: editPhrase(
          log.phrases,
          id,
          fields,
          runningDay(log.listeningDays, this.clock.now()),
        ),
      })),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });
  protected readonly isNewPhrase = computed(() => !this.draft.selected()?.text.trim());

  /** `null` until a counted phrase exists: no table of zeros. */
  protected readonly week = computed<readonly WeekRow[] | null>(() => {
    const phrases = this.store.value().phrases;
    if (countedPhrases(phrases).length === 0) {
      return null;
    }
    const format = new Intl.DateTimeFormat(this.locale(), { weekday: 'short', day: 'numeric' });
    return perDay(phrases, this.today()).map((row) => ({
      ...row,
      label: format.format(parseIsoDate(row.date)),
    }));
  });
  protected readonly streak = computed(() => streak(this.store.value().phrases, this.today()));

  protected readonly readyToMarkDone = computed(() => isComplete(this.store.value(), this.now()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'h1-language',
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), this.now(), labels) : null;
  });

  protected readonly done = this.progress.isDone(LANGUAGE_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(LANGUAGE_MODEL_KEY);

  /** Absolute navigation, for the reason `transition-page.ts`'s `goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${LANGUAGE_ROUTE}`, ...commands], options);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeDetail(): void {
    this.goTo([]);
  }

  protected onAddPhrase(): void {
    this.draft.start();
  }

  /** "Start listening" / "New day": a day starting now; nothing while one already runs. */
  protected onDayStarted(): void {
    this.store.update((log) => startDay(log, this.clock.now()));
    this.clockTick.refresh();
  }

  protected onDayEnded(id: string): void {
    this.store.update((log) => endDay(log, id, this.clock.now()));
    this.clockTick.refresh();
  }

  /** "Try this example" (issue #232): a real record at once, flagged `sample` until its first
   * edit; an example already tried and not yet edited opens that one instead. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const fields = phraseFromExample(sample);
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.store.value().phrases, fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Phrase = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.store.update((log) => ({ ...log, phrases: [...log.phrases, record] }))) {
      this.goTo([record.id], options);
    }
  }

  protected onItemChanged(id: string, fields: Partial<PhraseFields>): void {
    this.draft.edit(id, phraseEdit(fields));
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h1Language.list.deleted'),
      undoLabel: this.transloco.translate('h1Language.list.undo'),
      onConfirm: () =>
        this.store.update((log) => ({
          ...log,
          phrases: removePhrase(log.phrases, id, this.clock.now()),
        })),
      onUndo: () =>
        this.store.update((log) => ({
          ...log,
          phrases: restorePhrase(log.phrases, id, this.clock.now()),
        })),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(LANGUAGE_MODEL_KEY);
    } else {
      this.progress.markDone(LANGUAGE_MODEL_KEY);
    }
  }
}
