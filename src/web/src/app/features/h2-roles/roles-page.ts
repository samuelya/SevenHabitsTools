import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import {
  translateObjectSignal,
  translateSignal,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { Numerals } from '../../core/i18n/language';
import { intlLocaleFor } from '../../core/i18n/locale.logic';
import { CLOCK } from '../../core/time/clock';
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
import {
  BuiltInRoleLabels,
  RoleDirection,
  RoleEdit,
  activeRoles,
  archivedRoles,
  canMove,
  nextOrder,
  roleLabel,
  tooMany,
} from '../../shared/roles/roles.logic';
import { Role } from '../../shared/roles/roles.model';
import { RolesService } from '../../shared/roles/roles.service';
import { countsForRoles, goalsForRole } from '../../shared/roles/role-goals.logic';
import { RoleGoal } from '../../shared/roles/role-goals.model';
import { RoleGoalsService } from '../../shared/roles/role-goals.service';
import {
  COUNT_TOKEN,
  GoalActionEvent,
  GoalExample,
  goalCountLine,
  goalFromExample,
  isGoalDraftWorthSaving,
  liveSampleGoalOf,
  roleNamed,
} from './goals.logic';
import { RoleGoalsSection } from './role-goals-section';
import { RolesItemForm } from './roles-item-form';
import { RolesSummary } from './roles-summary';
import {
  CHECKLIST_KEYS,
  MAX_TOKEN,
  RoleLabels,
  VALUE_TOKEN,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  liveSampleOf,
  roleFromExample,
  roleEditFields,
  summarize,
  toListItem,
} from './roles.logic';
import { H2_ROLES_ID, H2_ROLES_ROUTE } from './roles.model';

/**
 * Your roles (issue #59), the reference exercise for Habit 2: a list exercise copied from
 * `h1-commitments` (routing, draft before record, samples and delete-with-undo work the same way;
 * see `TransitionPage`). The container: it reads roles through `RolesService`, the only writer of
 * `shared.roles`, and passes plain values down. Archived roles sit in their own collapsed group.
 * A saved role's editor holds its goals (issue #291), written through `RoleGoalsService`, with one
 * goal open at a time and a new one kept as a draft until its "what" is typed.
 */
@Component({
  selector: 'app-roles-page',
  imports: [
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    RoleGoalsSection,
    RolesItemForm,
    RolesSummary,
    TranslocoPipe,
  ],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly roles = inject(RolesService);
  private readonly goalsService = inject(RoleGoalsService);
  private readonly numerals = featureStore<Numerals>('numerals');
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal(H2_ROLES_ID);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  protected readonly list = this.roles.all;
  private readonly goals = this.goalsService.all;
  protected readonly started = computed(() => isStarted(this.list()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);

  // Labels: `translateSignal` with the scope named, keys relative to it (playbook §6). The
  // built-in's label lives in `exercise-kit`, where every consumer of `shared.roles` can read it.
  private readonly renewalLabel = translateSignal('roles.renewal', undefined, 'exercise-kit');
  protected readonly builtInLabels = computed<BuiltInRoleLabels>(() => ({
    renewal: this.renewalLabel() ?? '',
  }));
  private readonly exampleLabel = translateSignal('list.example', undefined, H2_ROLES_ID);
  private readonly builtInText = translateSignal('list.builtIn', undefined, H2_ROLES_ID);
  private readonly ratingTemplate = translateSignal(
    'list.ratingText',
    { value: VALUE_TOKEN, max: MAX_TOKEN },
    H2_ROLES_ID,
  );
  private readonly goalCountForms = translateObjectSignal(
    'goals.countText',
    { count: COUNT_TOKEN },
    H2_ROLES_ID,
  );
  private readonly labels = computed<RoleLabels>(() => {
    const format = new Intl.NumberFormat(intlLocaleFor(this.lang(), this.numerals.value()));
    const plural = new Intl.PluralRules(this.lang());
    const forms = (this.goalCountForms() ?? {}) as Record<string, string>;
    return {
      builtIn: this.builtInLabels(),
      builtInText: this.builtInText(),
      example: this.exampleLabel(),
      ratingTemplate: this.ratingTemplate(),
      formatNumber: (value) => format.format(value),
      goalCount: (count) => goalCountLine(forms, plural.select(count), format.format(count)),
    };
  });
  private readonly goalCounts = computed(() =>
    countsForRoles(
      this.goals(),
      this.list().map((role) => role.id),
    ),
  );

  protected readonly activeItems = computed(() => this.listItems(activeRoles(this.list())));
  protected readonly archivedItems = computed(() => this.listItems(archivedRoles(this.list())));
  protected readonly tooMany = computed(() => tooMany(this.list()));

  protected readonly draft = recordDraft<Role>({
    itemId: this.itemId,
    records: this.list,
    create: () => newRecord({ name: '', order: nextOrder(this.list()) }, this.clock.now()),
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.roles.insert(record),
    update: (id, fields) => this.roles.update(id, fields as RoleEdit),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });
  protected readonly selectedLabel = computed(() => {
    const selected = this.draft.selected();
    return selected ? roleLabel(selected, this.builtInLabels()) : '';
  });
  protected readonly canMoveUp = computed(() => this.canMoveSelected('up'));
  protected readonly canMoveDown = computed(() => this.canMoveSelected('down'));

  /** Whether the archived group is open. The toggle always flips it. Selecting (or archiving) an
   * archived role opens it, and leaving that role opens it too, so closing the editor never hides
   * the row focus returns to. The source is the id, not the record, so an edit doesn't reset it. */
  protected readonly archivedExpanded = linkedSignal<string | null, boolean>({
    source: () => {
      const selected = this.draft.selected();
      return selected?.archived === true ? selected.id : null;
    },
    computation: (archivedId, previous) =>
      archivedId !== null || (previous?.source ?? null) !== null || (previous?.value ?? false),
  });

  // Goals (issue #291): the open goal is page state, keyed to the selected role, so switching role
  // or closing the editor closes it; `new` is the unsaved goal draft (`recordDraft()`).
  private readonly selectedRoleId = computed(() => this.draft.selected()?.id ?? null);
  private readonly goalItemId = linkedSignal<string | null, string | null>({
    source: this.selectedRoleId,
    computation: () => null,
  });
  private readonly roleGoals = computed(() => {
    const roleId = this.selectedRoleId();
    return roleId === null ? [] : goalsForRole(this.goals(), roleId);
  });
  protected readonly goalDraft = recordDraft<RoleGoal>({
    itemId: this.goalItemId,
    records: this.roleGoals,
    create: () =>
      newRecord(
        {
          roleId: untracked(this.selectedRoleId) ?? '',
          what: '',
          horizon: 'year' as const,
          status: 'open' as const,
          steps: [],
        },
        this.clock.now(),
      ),
    isWorthSaving: isGoalDraftWorthSaving,
    save: (record) => this.goalsService.insert(record),
    update: (id, fields) => this.goalsService.update(id, fields),
    navigate: (segment) => this.goalItemId.set(segment),
    now: () => this.clock.now(),
  });
  /** The unsaved goal draft's id, or `null`. */
  protected readonly unsavedGoalId = computed(() =>
    this.goalDraft.unsaved() ? (this.goalDraft.selected()?.id ?? null) : null,
  );
  /** The role's goals, newest first, with an unsaved draft on top: the same slot its saved copy
   * takes, so the first typed character doesn't recreate the form. */
  protected readonly displayGoals = computed(() => {
    const draft = this.goalDraft.selected();
    return draft !== null && this.goalDraft.unsaved()
      ? [draft, ...this.roleGoals()]
      : this.roleGoals();
  });
  protected readonly expandedGoalId = computed(() => this.goalDraft.selected()?.id ?? null);

  protected readonly summary = computed(() => summarize(this.list(), this.goals()));
  protected readonly readyToMarkDone = computed(() => isComplete(this.list(), this.goals()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    H2_ROLES_ID,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.list(), this.goals(), labels) : null;
  });

  protected readonly done = this.progress.isDone(H2_ROLES_ID);
  protected readonly completedAt = this.progress.completedAt(H2_ROLES_ID);

  private listItems(roles: readonly Role[]) {
    const labels = this.labels();
    const counts = this.goalCounts();
    return roles.map((role) => toListItem(role, labels, counts.get(role.id) ?? 0));
  }

  private canMoveSelected(direction: RoleDirection): boolean {
    const selected = this.draft.selected();
    return selected !== null && canMove(this.list(), selected.id, direction);
  }

  /** Absolute navigation, for the reason `TransitionPage.goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${H2_ROLES_ROUTE}`, ...commands], options);
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

  /** "Try this example" (issue #232): a real role (or goal, #291) flagged `sample`. An untouched
   * one already tried opens instead of a copy. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const goal = goalFromExample(sample, () => crypto.randomUUID());
    if (goal !== null) {
      this.tryGoalExample(goal);
      return;
    }
    const fields = roleFromExample(sample);
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.list(), fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Role = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.roles.insert(record)) {
      this.goTo([record.id], options);
    }
  }

  /** The goal example goes on the live role with its name, the user's own or a sample one, which is
   * created (as a sample) when there is none; then that role opens with the goal expanded. */
  private tryGoalExample(example: GoalExample): void {
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    let role = roleNamed(this.list(), example.role.name);
    if (!role) {
      const record: Role = { ...newRecord(example.role, this.clock.now()), sample: true };
      if (!this.roles.insert(record)) {
        return;
      }
      role = record;
    }
    let goalId = liveSampleGoalOf(this.goals(), role.id, example.goal.what)?.id;
    if (goalId === undefined) {
      const record: RoleGoal = {
        ...newRecord({ ...example.goal, roleId: role.id }, this.clock.now()),
        sample: true,
      };
      if (!this.goalsService.insert(record)) {
        return;
      }
      goalId = record.id;
    }
    const opened = goalId;
    void this.router
      .navigate([`/${H2_ROLES_ROUTE}`, role.id], options)
      .then(() => this.goalItemId.set(opened));
  }

  protected onGoalAdd(): void {
    this.goalDraft.start();
  }

  /** Opens `id`, or closes the open goal; an untouched draft closes through `discard()`. */
  protected onGoalExpanded(id: string | null): void {
    const open = this.goalDraft.selected();
    if (id === null && open !== null && this.goalDraft.owns(open.id)) {
      this.goalDraft.discard();
      return;
    }
    this.goalItemId.set(id);
  }

  protected onGoalAction({ goalId, action }: GoalActionEvent): void {
    switch (action.kind) {
      case 'edit':
        this.goalDraft.edit(goalId, action.edit);
        return;
      case 'status':
        this.goalsService.setStatus(goalId, action.status);
        return;
      case 'reopen':
        this.goalsService.reopen(goalId);
        return;
      case 'addStep':
        this.goalsService.addStep(goalId);
        return;
      case 'editStep':
        this.goalsService.editStep(goalId, action.key, action.text);
        return;
      case 'toggleStep':
        this.goalsService.toggleStep(goalId, action.key, action.done);
        return;
      case 'removeStep':
        this.goalsService.removeStep(goalId, action.key);
        return;
      case 'delete':
        this.deleteGoal(goalId);
        return;
    }
  }

  private deleteGoal(id: string): void {
    if (this.goalDraft.owns(id)) {
      this.goalDraft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h2Roles.goal.deleted'),
      undoLabel: this.transloco.translate('h2Roles.list.undo'),
      onConfirm: () => this.goalsService.remove(id),
      onUndo: () => this.goalsService.restore(id),
    });
  }

  /** Cleaned before `draft.edit()`: the draft path merges fields as they come (playbook §6). */
  protected onItemChanged(id: string, edit: RoleEdit): void {
    this.draft.edit(id, roleEditFields(edit));
  }

  protected onMoved(id: string, direction: RoleDirection): void {
    this.roles.move(id, direction);
  }

  protected onArchivedChange(id: string, archived: boolean): void {
    if (archived) {
      this.roles.archive(id);
    } else {
      this.roles.unarchive(id);
    }
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h2Roles.list.deleted'),
      undoLabel: this.transloco.translate('h2Roles.list.undo'),
      onConfirm: () => this.roles.remove(id),
      onUndo: () => this.roles.restore(id),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(H2_ROLES_ID);
    } else {
      this.progress.markDone(H2_ROLES_ID);
    }
  }
}
