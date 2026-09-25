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
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, translateSignal } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { featureStore } from '../../core/data/feature-store';
import { isLive, newRecord } from '../../core/data/record';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { AppDialog } from '../../core/layout/app-dialog';
import { CLOCK } from '../../core/time/clock';
import { isDueOn } from '../../shared/commitments/commitments.logic';
import { CommitmentsService } from '../../shared/commitments/commitments.service';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import type { DeleteConfirmDialogData } from '../../shared/exercise-kit/delete-confirm-dialog/delete-confirm-dialog';
import { DELETE_CONFIRM_DIALOG_LOADER } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { exerciseGuideSignal } from '../../shared/exercise-kit/exercise-guide/exercise-guide-signal';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { ReflectionEditor } from '../../shared/exercise-kit/reflection-editor/reflection-editor';
import { todaySignal } from '../../shared/exercise-kit/today';
import { ChallengeCheckinForm, CheckInSubmission } from './challenge-checkin-form';
import { ChallengeDayDetail } from './challenge-day-detail';
import { ChallengeDayStrip } from './challenge-day-strip';
import { ChallengeStart, ChallengeStartForm } from './challenge-start-form';
import { ChallengeSummary } from './challenge-summary';
import {
  CHECKLIST_KEYS,
  ChallengeNote,
  activeChallenge,
  anchorDate,
  canCheckIn,
  canFinish,
  canSkip,
  canWriteMid,
  checkedInCount,
  checkinOn,
  checklistLabelsFrom,
  checklistLoaded,
  dayNumber,
  dayStates,
  displayDay,
  doneChecklist,
  finishChallenge,
  hasCounts,
  hasFinalNote,
  isComplete,
  isStarted,
  newChallengeFields,
  pastChallenges,
  promiseTally,
  stopChallenge,
  summarize,
  withCheckIn,
  withNote,
  withSkip,
} from './challenge.logic';
import { CHALLENGE_MODEL_KEY, CHALLENGE_ROUTE, Challenge } from './challenge.model';

/** The Promises exercise's id: the "See promises" link reads its route from the registry rather
 * than importing that feature's files (playbook §6, "Cross-feature data"). */
const PROMISES_EXERCISE_ID = 'h1-commitments';

/**
 * The 30-day test (issue #56), a tracker: one running test edited in place, past tests listed
 * below and opened read-only by id (`:itemId`, the same one-route matcher as `TransitionPage`).
 * The container: it reads the `h1-challenge` slice and today's date, applies the pure rules in
 * `challenge.logic.ts`, and reads promises through `CommitmentsService` without ever writing them.
 */
@Component({
  selector: 'app-challenge-page',
  imports: [
    AppDatePipe,
    AppPluralPipe,
    ChallengeCheckinForm,
    ChallengeDayDetail,
    ChallengeDayStrip,
    ChallengeStartForm,
    ChallengeSummary,
    DoneToggle,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    ReflectionEditor,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './challenge-page.html',
  styleUrl: './challenge-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengePage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = inject(AppDialog);
  private readonly loadConfirmDialog = inject(DELETE_CONFIRM_DIALOG_LOADER);
  private readonly store = featureStore<Challenge[]>(CHALLENGE_MODEL_KEY);
  private readonly commitments = inject(CommitmentsService);

  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal(CHALLENGE_MODEL_KEY);
  /** The local date of `CLOCK`, updated just after each local midnight. */
  protected readonly today = todaySignal();

  /** The `:itemId` route param (`withComponentInputBinding`): a past test opened read-only. */
  readonly itemId = input<string | null>(null);

  private readonly list = computed(() => this.store.value().filter(isLive));
  protected readonly started = computed(() => isStarted(this.list()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);

  protected readonly active = computed(() => activeChallenge(this.list()));
  protected readonly past = computed(() => pastChallenges(this.list()));
  /** The past test open read-only, `null` on the main view. */
  protected readonly viewed = computed(
    () => this.past().find((c) => c.id === this.itemId()) ?? null,
  );
  /** The test the strip shows: the one opened read-only, else the running one. */
  protected readonly shown = computed(() => this.viewed() ?? this.active());

  protected readonly day = computed(() => {
    const active = this.active();
    return active ? displayDay(dayNumber(active, this.today())) : 0;
  });
  protected readonly cells = computed(() => {
    const shown = this.shown();
    return shown ? dayStates(shown, this.today()) : [];
  });
  protected readonly anchor = computed(() => {
    const shown = this.shown();
    return shown ? anchorDate(shown, this.today()) : '';
  });
  /** The day open under the strip: tonight's check-in by default, reset when the test shown or
   * the date changes. */
  protected readonly selectedDate = linkedSignal<string | null>(() => {
    const shown = this.shown();
    return shown && canCheckIn(shown, this.today()) ? this.today() : null;
  });
  protected readonly selectedCell = computed(
    () => this.cells().find((cell) => cell.date === this.selectedDate()) ?? null,
  );
  protected readonly selectedCheckin = computed(() => {
    const shown = this.shown();
    const date = this.selectedDate();
    return shown && date ? checkinOn(shown, date) : undefined;
  });
  protected readonly showCheckinForm = computed(() => {
    const shown = this.shown();
    return (
      shown !== null && this.selectedDate() === this.today() && canCheckIn(shown, this.today())
    );
  });
  protected readonly selectedCanSkip = computed(() => {
    const shown = this.shown();
    const date = this.selectedDate();
    return shown !== null && date !== null && canSkip(shown, date, this.today());
  });

  protected readonly showMid = computed(() => {
    const active = this.active();
    return active !== null && canWriteMid(active, this.today());
  });
  protected readonly showFinal = computed(() => {
    const active = this.active();
    return active !== null && canFinish(active, this.today());
  });
  protected readonly finalWritten = computed(() => {
    const active = this.active();
    return active !== null && hasFinalNote(active);
  });

  protected readonly promisesDue = computed(() =>
    this.commitments.all().filter((c) => isDueOn(c, this.today())),
  );
  protected readonly route = CHALLENGE_ROUTE;
  protected readonly promisesRoute =
    getRegisteredExercises().find((entry) => entry.exerciseId === PROMISES_EXERCISE_ID)?.route ??
    null;

  /** The summary of the test on screen: the one open read-only, the running one, or else the
   * latest past one (what "Finish test" leaves behind). `null` while every count is zero. */
  protected readonly summary = computed(() => {
    const test = this.shown() ?? this.past()[0] ?? null;
    if (!test) {
      return null;
    }
    const summary = summarize(test, this.commitments.all(), this.today());
    return hasCounts(summary) ? summary : null;
  });
  protected readonly pastRows = computed(() =>
    this.past().map((c) => ({
      id: c.id,
      start: parseIsoDate(c.startDate),
      status: c.status,
      checkedIn: checkedInCount(c),
      promises: promiseTally(c, this.commitments.all(), this.today()),
    })),
  );

  protected readonly readyToMarkDone = computed(() => isComplete(this.list()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    CHALLENGE_MODEL_KEY,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.list(), this.today(), labels) : null;
  });
  protected readonly done = this.progress.isDone(CHALLENGE_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(CHALLENGE_MODEL_KEY);

  constructor() {
    // Opening a past test moves focus to its heading; closing it returns focus to its row.
    let previous: string | null = null;
    effect(() => {
      const viewed = this.viewed()?.id ?? null;
      untracked(() => {
        if (viewed !== previous) {
          const target = viewed
            ? '.viewed-heading'
            : previous
              ? `[data-challenge-id="${previous}"]`
              : null;
          previous = viewed;
          if (target) {
            this.focusAfterRender(target);
          }
        }
      });
    });
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  /** Applies `change` to the running test; `false` when nothing was written (no running test, a
   * refused rule, or a read-only tab). */
  private updateActive(change: (c: Challenge) => Challenge | null): boolean {
    const id = this.active()?.id;
    if (!id) {
      return false;
    }
    let changed = false;
    const written = this.store.update((list) =>
      list.map((c) => {
        if (c.id !== id) {
          return c;
        }
        const next = change(c);
        changed = next !== null;
        return next ?? c;
      }),
    );
    return written && changed;
  }

  protected onStart(start: ChallengeStart): void {
    if (this.active()) {
      return;
    }
    const record = newRecord(
      newChallengeFields(start.startDate, start.focus, this.today()),
      this.clock.now(),
    );
    if (this.store.update((list) => [...list, record])) {
      this.focusAfterRender('.day-title');
    }
  }

  protected onDaySelected(date: string): void {
    this.selectedDate.set(date);
  }

  protected onCheckinSaved(submission: CheckInSubmission): void {
    this.updateActive((c) =>
      withCheckIn(c, this.today(), submission.answers, submission.note, this.clock.now()),
    );
  }

  protected onSkipped(date: string, reason: string): void {
    this.updateActive((c) => withSkip(c, date, reason, this.today(), this.clock.now()));
  }

  protected onNoteChanged(field: ChallengeNote, text: string, editor: ReflectionEditor): void {
    editor.reportSaveOutcome(this.updateActive((c) => withNote(c, field, text, this.clock.now())));
  }

  protected onFinish(): void {
    if (this.updateActive((c) => finishChallenge(c, this.today(), this.clock.now()))) {
      this.focusAfterRender('h1');
    }
  }

  protected async onStop(): Promise<void> {
    const { DeleteConfirmDialog } = await this.loadConfirmDialog();
    const ref = await this.dialog.open<
      InstanceType<typeof DeleteConfirmDialog>,
      DeleteConfirmDialogData,
      boolean
    >(DeleteConfirmDialog, {
      data: {
        title: this.transloco.translate('h1Challenge.stop.stopButton'),
        body: this.transloco.translate('h1Challenge.stop.confirmText'),
        confirmLabel: this.transloco.translate('h1Challenge.stop.confirmButton'),
        cancelLabel: this.transloco.translate('h1Challenge.stop.cancelButton'),
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) {
      return;
    }
    if (this.updateActive((c) => stopChallenge(c, this.today(), this.clock.now()))) {
      this.focusAfterRender('h1');
    }
  }

  protected closeViewed(): void {
    void this.router.navigate([`/${CHALLENGE_ROUTE}`]);
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(CHALLENGE_MODEL_KEY);
    } else {
      this.progress.markDone(CHALLENGE_MODEL_KEY);
    }
  }
}
