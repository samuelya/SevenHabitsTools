import { Injectable, Signal, computed, inject } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { isLive, newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { localDateString } from '../exercise-kit/assessment-history.logic';
import {
  GoalEdit,
  OpenStep,
  addStep,
  editGoal,
  editStep,
  goalsForRole,
  insertGoal,
  openSteps,
  removeGoal,
  removeGoalsForRole,
  removeStep,
  reopenGoal,
  restoreGoal,
  restoreGoalsForRole,
  setGoalStatus,
  toggleStep,
} from './role-goals.logic';
import { GoalHorizon, ROLE_GOALS_MODEL_KEY, RoleGoal } from './role-goals.model';
import { ROLES_MODEL_KEY, Role } from './roles.model';

/** What another tool supplies to add a goal. */
export interface NewRoleGoal {
  readonly roleId: string;
  readonly what: string;
  readonly horizon?: GoalHorizon;
}

/**
 * The only writer of `habits.h2.roleGoals` (issue #291): the Roles page edits goals, and
 * `RolesService` takes a role's goals with it on delete and undo. The weekly planner (#71) reads
 * `openSteps()`. Every write returns whether it applied (`false` in a read-only tab,
 * `FeatureStore.update()`); a refused or no-op edit leaves the list unchanged, and the store writes
 * nothing for it (same-reference no-op). It reads `shared.roles` directly, never through
 * `RolesService`, which depends on this service for its delete cascade.
 */
@Injectable({ providedIn: 'root' })
export class RoleGoalsService {
  private readonly clock = inject(CLOCK);
  private readonly store = featureStore<readonly RoleGoal[]>(ROLE_GOALS_MODEL_KEY);
  private readonly roles = featureStore<readonly Role[]>(ROLES_MODEL_KEY).value;

  /** Every live goal, samples included. */
  readonly all: Signal<readonly RoleGoal[]> = computed(() => this.store.value().filter(isLive));

  /** Steps the weekly planner may offer as big rocks: those of counted goals of active roles
   * (`openSteps()`). */
  readonly openSteps: Signal<readonly OpenStep[]> = computed(() =>
    openSteps(this.store.value(), this.roles()),
  );

  /** The live goals of `roleId`, newest first. A signal read, like `RolesService.byId()`. */
  forRole(roleId: string): RoleGoal[] {
    return goalsForRole(this.store.value(), roleId);
  }

  /** Adds an open goal with no steps; returns its id, or `null` if the store refused the write. */
  add(fields: NewRoleGoal): string | null {
    const record: RoleGoal = newRecord(
      {
        roleId: fields.roleId,
        what: fields.what,
        horizon: fields.horizon ?? 'year',
        status: 'open' as const,
        steps: [],
      },
      this.clock.now(),
    );
    return this.insert(record) ? record.id : null;
  }

  /** Stores a record built by the caller, id included: the page's draft-before-record (issue #217)
   * and guide samples (issue #232). */
  insert(record: RoleGoal): boolean {
    return this.apply((list) => insertGoal(list, record));
  }

  update(id: string, edit: GoalEdit): boolean {
    return this.apply((list) => editGoal(list, id, edit, this.clock.now()));
  }

  /** Reached or Dropped, dated today (local). */
  setStatus(id: string, status: 'reached' | 'dropped'): boolean {
    const now = this.clock.now();
    return this.apply((list) => setGoalStatus(list, id, status, localDateString(now), now));
  }

  reopen(id: string): boolean {
    return this.apply((list) => reopenGoal(list, id, this.clock.now()));
  }

  /** Appends an empty step; returns its key, or `null` when refused (five already, read-only). */
  addStep(id: string): string | null {
    const key = crypto.randomUUID();
    this.apply((list) => addStep(list, id, key, this.clock.now()));
    const added = this.store
      .value()
      .some((goal) => goal.id === id && goal.steps.some((step) => step.key === key));
    return added ? key : null;
  }

  editStep(id: string, key: string, text: string): boolean {
    return this.apply((list) => editStep(list, id, key, text, this.clock.now()));
  }

  toggleStep(id: string, key: string, done: boolean): boolean {
    return this.apply((list) => toggleStep(list, id, key, done, this.clock.now()));
  }

  removeStep(id: string, key: string): boolean {
    return this.apply((list) => removeStep(list, id, key, this.clock.now()));
  }

  /** Soft delete. */
  remove(id: string): boolean {
    return this.apply((list) => removeGoal(list, id, this.clock.now()));
  }

  /** Undoes `remove()`. */
  restore(id: string): boolean {
    return this.apply((list) => restoreGoal(list, id, this.clock.now()));
  }

  /** Soft-deletes every live goal of `roleId`, marked as deleted with it (`RolesService`). */
  removeForRole(roleId: string, deletedAt: Date): boolean {
    return this.apply((list) => removeGoalsForRole(list, roleId, deletedAt));
  }

  /** Undoes `removeForRole()`: exactly the goals deleted with `roleId` come back. */
  restoreForRole(roleId: string): boolean {
    return this.apply((list) => restoreGoalsForRole(list, roleId, this.clock.now()));
  }

  /** Runs `change` once; a no-op returns the same list, which the store doesn't write. */
  private apply(change: (list: readonly RoleGoal[]) => readonly RoleGoal[]): boolean {
    return this.store.update(change);
  }
}
