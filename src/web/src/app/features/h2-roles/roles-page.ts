import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
import { RolesItemForm } from './roles-item-form';
import { RolesSummary } from './roles-summary';
import {
  CHECKLIST_KEYS,
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
  private readonly numerals = featureStore<Numerals>('numerals');
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal(H2_ROLES_ID);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  protected readonly list = this.roles.all;
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
    { value: VALUE_TOKEN },
    H2_ROLES_ID,
  );
  private readonly labels = computed<RoleLabels>(() => {
    const format = new Intl.NumberFormat(intlLocaleFor(this.lang(), this.numerals.value()));
    return {
      builtIn: this.builtInLabels(),
      builtInText: this.builtInText(),
      example: this.exampleLabel(),
      ratingTemplate: this.ratingTemplate(),
      formatNumber: (value) => format.format(value),
    };
  });

  protected readonly activeItems = computed(() =>
    activeRoles(this.list()).map((role) => toListItem(role, this.labels())),
  );
  protected readonly archivedItems = computed(() =>
    archivedRoles(this.list()).map((role) => toListItem(role, this.labels())),
  );
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

  /** The archived group's toggle; it is also open while an archived role is being edited. */
  private readonly archivedToggled = signal(false);
  protected readonly archivedExpanded = computed(
    () => this.archivedToggled() || this.draft.selected()?.archived === true,
  );

  protected readonly summary = computed(() => summarize(this.list()));
  protected readonly readyToMarkDone = computed(() => isComplete(this.list()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    H2_ROLES_ID,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.list(), labels) : null;
  });

  protected readonly done = this.progress.isDone(H2_ROLES_ID);
  protected readonly completedAt = this.progress.completedAt(H2_ROLES_ID);

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
    this.archivedToggled.set(!this.archivedExpanded());
  }

  /** "Try this example" (issue #232): a real role flagged `sample`. An untouched one already tried
   * opens instead of a copy. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
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
