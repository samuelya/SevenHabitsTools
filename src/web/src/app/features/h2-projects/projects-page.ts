import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { isLive, newRecord } from '../../core/data/record';
import { LanguageStore } from '../../core/i18n/language-store';
import { intlLocaleFor } from '../../core/i18n/locale.logic';
import { translatePlural } from '../../core/i18n/plural.logic';
import { CLOCK } from '../../core/time/clock';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
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
import { ProjectItemForm } from './project-item-form';
import { ProjectsSummary } from './projects-summary';
import {
  CHECKLIST_KEYS,
  ProjectLabels,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editFields,
  editProject,
  finishedProjects,
  insertProject,
  isComplete,
  isDraftWorthSaving,
  isFinished,
  isStarted,
  liveSampleOf,
  projectFromExample,
  removeProject,
  restoreProject,
  summarize,
  toListItem,
  underWayProjects,
} from '../../shared/projects/projects.logic';
import { PROJECTS_MODEL_KEY, Project, ProjectFields } from '../../shared/projects/projects.model';
import { ProjectsService } from '../../shared/projects/projects.service';
import { PROJECTS_ROUTE } from './projects.model';

/**
 * Your projects (issue #65): a list exercise copied from `AffirmationsPage` (routing, draft before
 * record, samples and delete-with-undo work the same way), with the finished projects in a
 * collapsed group. The container: it reads `ProjectsService` and stores what the form emits.
 */
@Component({
  selector: 'app-projects-page',
  imports: [
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    ProjectItemForm,
    ProjectsSummary,
    TranslocoPipe,
  ],
  templateUrl: './projects-page.html',
  styleUrl: './projects-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly languageStore = inject(LanguageStore);
  private readonly projects = inject(ProjectsService);

  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal(PROJECTS_MODEL_KEY);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  /** The local date, updated just after midnight ("Overdue"). */
  private readonly today = todaySignal();

  protected readonly started = computed(() => isStarted(this.list()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);

  // Labels: `translateSignal` with the scope named, keys relative to it (playbook §6). The
  // progress text reads Transloco directly (`translatePlural()`); these signals make the labels
  // recompute once the scope loads, and the language on a switch.
  private readonly exampleLabel = translateSignal('list.example', undefined, PROJECTS_MODEL_KEY);
  private readonly overdueLabel = translateSignal('list.overdue', undefined, PROJECTS_MODEL_KEY);
  private readonly labels = computed<ProjectLabels>(() => {
    const locale = intlLocaleFor(this.languageStore.language(), this.languageStore.numerals());
    const numbers = new Intl.NumberFormat(locale);
    const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    return {
      example: this.exampleLabel() ?? '',
      overdue: this.overdueLabel() ?? '',
      progress: (done, total) =>
        translatePlural(this.transloco, 'h2Projects.list.progressText', total, {
          done: numbers.format(done),
          total: numbers.format(total),
        }),
      formatDate: (date) => dates.format(parseIsoDate(date)),
    };
  });

  private readonly list = computed(() => this.projects.value());
  private readonly live = computed(() => this.list().filter(isLive));
  protected readonly underWayItems = computed(() => this.listItems(underWayProjects(this.list())));
  protected readonly finishedItems = computed(() => this.listItems(finishedProjects(this.list())));

  protected readonly draft = recordDraft<Project>({
    itemId: this.itemId,
    records: this.live,
    create: () =>
      newRecord<ProjectFields>(
        { name: '', criteria: [], steps: [], status: 'planning' },
        this.clock.now(),
      ),
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.projects.update((list) => insertProject(list, record)),
    update: (id, fields) =>
      this.projects.update((list) => editProject(list, id, fields, this.clock.now())),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });

  /** Whether the Finished group is open: collapsed by default; selecting a finished project, or
   * finishing the one open, opens it. Otherwise it stays as the user left it, also when the
   * selection leaves a finished project. Keyed to the id so an edit doesn't reset it (playbook
   * §6). */
  protected readonly finishedExpanded = linkedSignal<string | null, boolean>({
    source: () => {
      const selected = this.draft.selected();
      return selected && isFinished(selected.status) ? selected.id : null;
    },
    computation: (finishedId, previous) => finishedId !== null || (previous?.value ?? false),
  });

  protected readonly summary = computed(() => summarize(this.list()));
  protected readonly readyToMarkDone = computed(() => isComplete(this.list()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    PROJECTS_MODEL_KEY,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.list(), labels) : null;
  });

  protected readonly done = this.progress.isDone(PROJECTS_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(PROJECTS_MODEL_KEY);

  private listItems(projects: readonly Project[]) {
    const today = this.today();
    const labels = this.labels();
    return projects.map((project) => toListItem(project, today, labels));
  }

  /** Absolute navigation, for the reason `TransitionPage.goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${PROJECTS_ROUTE}`, ...commands], options);
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

  protected toggleFinished(): void {
    this.finishedExpanded.update((open) => !open);
  }

  /** "Try this example" (issue #232): a real project flagged `sample`, its deadline (if any)
   * counted from today. An untouched one already tried opens instead of a copy. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const fields = projectFromExample(sample, this.today(), () => crypto.randomUUID());
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.list(), fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Project = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.projects.update((list) => insertProject(list, record))) {
      this.goTo([record.id], options);
    }
  }

  /** Cleaned before `draft.edit()`: the draft path merges fields as they come (playbook §6). */
  protected onItemChanged(id: string, edit: Partial<ProjectFields>): void {
    this.draft.edit(id, editFields(edit));
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h2Projects.list.deleted'),
      undoLabel: this.transloco.translate('h2Projects.list.undo'),
      onConfirm: () => this.projects.update((list) => removeProject(list, id, this.clock.now())),
      onUndo: () => this.projects.update((list) => restoreProject(list, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(PROJECTS_MODEL_KEY);
    } else {
      this.progress.markDone(PROJECTS_MODEL_KEY);
    }
  }
}
