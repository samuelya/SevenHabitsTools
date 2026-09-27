import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { RoleGoal } from '../../shared/roles/role-goals.model';
import { GoalActionEvent } from './goals.logic';
import { RoleGoalForm } from './role-goal-form';

/**
 * "Goals for this role" (issue #291), below "The picture" in the role editor: "Add goal", then the
 * role's goals newest first, one expanded at a time into its `RoleGoalForm`. Presentational: the
 * page owns the goal draft (`recordDraft()`), so `goals` already holds an unsaved draft first,
 * `expandedId` names the open goal and `unsavedId` the draft, if any.
 */
@Component({
  selector: 'app-role-goals-section',
  imports: [MatButtonModule, MatIconModule, RoleGoalForm, TranslocoPipe],
  templateUrl: './role-goals-section.html',
  styleUrl: './role-goals-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleGoalsSection {
  /** The role the goals belong to; ids in this section are built from it. */
  readonly roleId = input.required<string>();
  readonly goals = input.required<readonly RoleGoal[]>();
  readonly expandedId = input<string | null>(null);
  readonly unsavedId = input<string | null>(null);

  readonly added = output<void>();
  /** A goal header was pressed: the goal to open, or `null` to close the open one. */
  readonly expandedChange = output<string | null>();
  readonly goalAction = output<GoalActionEvent>();

  protected toggle(id: string): void {
    this.expandedChange.emit(this.expandedId() === id ? null : id);
  }
}
