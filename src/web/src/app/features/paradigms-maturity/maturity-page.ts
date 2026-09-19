import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
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
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { MaturityAssessmentForm } from './maturity-assessment-form';
import { MaturityResult } from './maturity-result';
import { MaturitySummary } from './maturity-summary';
import {
  addAssessment,
  canMarkDone,
  editAssessment,
  liveAssessmentsOf,
  newAssessmentFields,
  overallProfile,
  removeAssessment,
  restoreAssessment,
  summarize,
} from './maturity.logic';
import {
  MATURITY_AREA_KEYS,
  MATURITY_LEVELS,
  MATURITY_MODEL_KEY,
  MATURITY_ROUTE,
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
  protected readonly progress = inject(ExerciseProgress);

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
  protected readonly selectedAssessment = computed(
    () => this.assessments().find((assessment) => assessment.id === this.itemId()) ?? null,
  );
  protected readonly previous = computed(() => {
    const selected = this.selectedAssessment();
    return selected ? previousAssessment(this.assessments(), selected.id) : null;
  });
  protected readonly hasDetail = computed(() => this.selectedAssessment() !== null);
  /** This page's `store.update()` is always synchronous, so there's no "saving" state to show —
   * see the playbook's "Page layout" section. */
  protected readonly editorStatus = computed<'saved' | 'saving' | null>(() =>
    this.hasDetail() ? 'saved' : null,
  );
  protected readonly summary = computed(() => summarize(this.store.value()));
  protected readonly readyToMarkDone = computed(() => canMarkDone(this.store.value()));

  protected readonly done = this.progress.isDone(MATURITY_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(MATURITY_MODEL_KEY);

  constructor() {
    // An `:itemId` that isn't a live assessment redirects to the history (issue #187's pattern).
    // Guard `id != null`, not `id !== null`: `withComponentInputBinding()`'s default
    // `unmatchedInputBehavior` is `'alwaysUndefined'`, so closing the editor sets `itemId` to
    // `undefined`, not this input's own `null` default.
    effect(() => {
      const id = this.itemId();
      if (id != null && !this.assessments().some((assessment) => assessment.id === id)) {
        this.goToList();
      }
    });
  }

  /** Absolute, not relative to `this.route` — see `TransitionPage.goTo()`'s doc comment for why
   * relative navigation doesn't resolve against this feature's lazily mounted route. */
  private goTo(commands: readonly string[]): void {
    void this.router.navigate([`/${MATURITY_ROUTE}`, ...commands]);
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

  protected onNewAssessment(): void {
    const now = this.clock.now();
    const latest = this.history()[0] ?? null;
    const fields: MaturityAssessmentFields = newAssessmentFields(latest, localDateString(now));
    let createdId: string | null = null;
    const applied = this.store.update((assessments) => {
      const next = addAssessment(assessments, fields, now);
      createdId = next[next.length - 1].id;
      return next;
    });
    if (applied && createdId) {
      this.goTo([createdId]);
    }
  }

  protected onAssessmentChanged(id: string, fields: Partial<MaturityAssessmentFields>): void {
    this.store.update((assessments) => editAssessment(assessments, id, fields));
  }

  /** Confirm → delete → undo (issue #203's shared pattern, playbook's "Deleting entries"). The
   * redirect effect above closes the editor once the delete lands, since the id is then no longer
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
