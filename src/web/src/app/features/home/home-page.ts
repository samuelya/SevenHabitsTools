import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  Signal,
  computed,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BACKUP_MODEL_KEY, BackupSettings } from '../../core/data/backup/backup.model';
import { DocumentImportExportService } from '../../core/data/backup/document-import-export.service';
import { ExportReminderDismissal } from '../../core/data/backup/export-reminder-dismissal';
import { shouldShowExportReminder } from '../../core/data/backup/export-reminder.logic';
import { DocumentMeta } from '../../core/data/document.model';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { habitListLayout } from '../../core/habits/habit-list.logic';
import { HABITS, HabitId } from '../../core/habits/habits';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { CLOCK } from '../../core/time/clock';
import { exerciseStatusSignal } from '../../shared/exercise-kit/exercise-hub-status';
import { HabitExerciseProgress } from '../../shared/exercise-kit/exercise-progress.logic';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import {
  ExerciseHubStatus,
  ExerciseRegistryEntry,
  getRegisteredExercises,
} from '../../shared/exercise-kit/exercise-registry';
import { exerciseStartedSignal } from '../../shared/exercise-kit/exercise-started';
import { ExportReminderBanner } from '../../shared/ui/export-reminder-banner/export-reminder-banner';
import { HabitProgress } from '../../shared/ui/habit-progress/habit-progress';
import { ContinueCard } from './continue-card';
import { todayContinueTarget } from './today.logic';

/** What the Continue card says under its habit: nothing until the exercise is started, then its own
 * in-progress text ("2 of 3 steps"), or a generic "In progress" when it registers none. */
type ContinueStatus = ExerciseHubStatus | 'started' | null;

/** Home, shown as "Today" (issue #220): the export reminder, a first-run paragraph until the first
 * "Mark done", a Continue card to the next exercise, and progress for the available habits plus
 * the next one. Reads `ExerciseProgress` and the exercise registry; stores nothing. */
@Component({
  selector: 'app-home-page',
  imports: [
    MatIconModule,
    MatListModule,
    RouterLink,
    ExportReminderBanner,
    HabitProgress,
    ContinueCard,
    TranslocoPipe,
    AppPluralPipe,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly meta = inject(DocumentStore).select<DocumentMeta>('meta');
  private readonly backup = featureStore<BackupSettings>(BACKUP_MODEL_KEY);
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly dismissal = inject(ExportReminderDismissal);
  private readonly importExport = inject(DocumentImportExportService);
  private readonly clock = inject(CLOCK);
  private readonly progress = inject(ExerciseProgress);
  private readonly injector = inject(Injector);

  // `now` is read once per computation, not on a timer: a banner that becomes due while the user
  // is already on this page can wait for the next edit, dismissal or navigation back here to
  // reconsider it, rather than this page polling the clock.
  protected readonly showExportReminder = computed(() =>
    shouldShowExportReminder({
      documentCreatedAt: this.meta()?.createdAt ?? '',
      documentUpdatedAt: this.meta()?.updatedAt ?? '',
      lastExportedAt: this.backup.value().lastExportedAt,
      lastExportedDocumentUpdatedAt: this.backup.value().lastExportedDocumentUpdatedAt,
      reminderDays: this.backup.value().reminderDays,
      now: this.clock.now(),
      dismissedToday: this.dismissal.dismissed(),
      isWriter: this.writerLock.isWriter(),
    }),
  );

  /** Derived, never stored: no exercise has ever been marked done. */
  protected readonly firstRun = computed(() => !this.progress.anyCompletion());

  protected readonly continueTarget = computed(() =>
    todayContinueTarget(HABITS, getRegisteredExercises(), (exerciseId) =>
      this.progress.isDone(exerciseId)(),
    ),
  );

  protected readonly continueStatus = computed<ContinueStatus>(() => {
    const target = this.continueTarget();
    return target ? this.statusFor(target.exercise)() : null;
  });

  /** The habits list's own split (#219): available habits, then the next one; never all nine.
   * Registered exercises are fixed at module load, so this only reads `total`. */
  private readonly layout = computed(() =>
    habitListLayout(HABITS, (habit) => this.progressFor(habit)().total > 0),
  );

  protected readonly progressRows = computed(() => this.layout().shown);

  protected readonly nextUpHabit = computed(
    () => this.layout().shown.find((row) => row.state === 'nextUp')?.habit,
  );

  protected progressFor(habit: HabitId): Signal<HabitExerciseProgress> {
    return this.progress.progressFor(habit);
  }

  /** One memoized status per exercise, so the factories run once each (same reasoning as the
   * habit hub's row cache). */
  private readonly statusCache = new Map<string, Signal<ContinueStatus>>();

  private statusFor(entry: ExerciseRegistryEntry): Signal<ContinueStatus> {
    let status = this.statusCache.get(entry.exerciseId);
    if (!status) {
      const exerciseStatus = exerciseStatusSignal(entry, this.injector);
      const started = exerciseStartedSignal(entry, this.injector);
      status = computed(() => (started() ? (exerciseStatus() ?? 'started') : null));
      this.statusCache.set(entry.exerciseId, status);
    }
    return status;
  }

  protected exportNow(): void {
    void this.importExport.exportDocument();
  }

  protected dismissReminder(): void {
    this.dismissal.dismiss();
  }
}
