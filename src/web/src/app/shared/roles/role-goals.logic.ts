import { isLive, softDelete, touch } from '../../core/data/record';
import { isCounted, withoutSample } from '../exercise-kit/sample-record.logic';
import { GoalHorizon, GoalStep, RoleGoal, isGoalHorizon } from './role-goals.model';

/**
 * The shared, pure half of `habits.h2.roleGoals` (issue #291): what the Roles page and the weekly
 * planner (#71) read, plus the array edits `RoleGoalsService` applies. Time comes in as `now` (and
 * the local date as `today`), never read here. Every edit that changes nothing returns `list`
 * itself, so the store sees a no-op.
 */

/** "Five is plenty." */
export const MAX_GOAL_STEPS = 5;

/** A step's text as every reader sees it: trimmed. A step with no text yet (just added) is kept in
 * the goal for the user to fill, but counts as no step anywhere: `hasStep()`, `openSteps()`. */
export function stepText(step: Pick<GoalStep, 'text'>): string {
  return step.text.trim();
}

export function isFilledStep(step: Pick<GoalStep, 'text'>): boolean {
  return stepText(step) !== '';
}

/** Whether `goal` has at least one first step with text. */
export function hasStep(goal: Pick<RoleGoal, 'steps'>): boolean {
  return goal.steps.some(isFilledStep);
}

/** Newest first; ties by id, so the order is stable. */
function newestFirst(a: RoleGoal, b: RoleGoal): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

/** The live goals of `roleId`, newest first. */
export function goalsForRole(list: readonly RoleGoal[], roleId: string): RoleGoal[] {
  return list.filter((goal) => isLive(goal) && goal.roleId === roleId).sort(newestFirst);
}

/** A step the weekly planner (#71) may offer as a big rock. */
export interface OpenStep {
  readonly goalId: string;
  readonly roleId: string;
  readonly key: string;
  readonly text: string;
}

/** Every step with text, not done, of a live, open goal the user made (not an untouched guide
 * example), newest goal first and steps in order. */
export function openSteps(list: readonly RoleGoal[]): OpenStep[] {
  return list
    .filter((goal) => isCounted(goal) && goal.status === 'open')
    .sort(newestFirst)
    .flatMap((goal) =>
      goal.steps
        .filter((step) => !step.done && isFilledStep(step))
        .map((step) => ({
          goalId: goal.id,
          roleId: goal.roleId,
          key: step.key,
          text: stepText(step),
        })),
    );
}

/** How many live goals each of `roleIds` has (0 included). */
export function countsForRoles(
  list: readonly RoleGoal[],
  roleIds: readonly string[],
): ReadonlyMap<string, number> {
  const counts = new Map(roleIds.map((id) => [id, 0]));
  for (const goal of list) {
    const count = counts.get(goal.roleId);
    if (count !== undefined && isLive(goal)) {
      counts.set(goal.roleId, count + 1);
    }
  }
  return counts;
}

const CLEARABLE_FIELDS: readonly string[] = ['why', 'how'];

/** `goal` as it is stored: no `undefined` value, no cleared (`''`) why or how, no `resolvedOn` on
 * an open goal. Every write goes through it. */
export function tidyGoal(goal: RoleGoal): RoleGoal {
  return Object.fromEntries(
    Object.entries(goal).filter(
      ([key, value]) =>
        value !== undefined &&
        !(value === '' && CLEARABLE_FIELDS.includes(key)) &&
        !(key === 'resolvedOn' && goal.status === 'open'),
    ),
  ) as unknown as RoleGoal;
}

/** Appends `record`, tidied; `list` itself when its id is already there. */
export function insertGoal(list: readonly RoleGoal[], record: RoleGoal): readonly RoleGoal[] {
  if (list.some((goal) => goal.id === record.id)) {
    return list;
  }
  return [...list, tidyGoal(record)];
}

/** What `update()` may change. `''` clears why or how; a blank `what` is ignored. */
export interface GoalEdit {
  readonly what?: string;
  readonly why?: string;
  readonly how?: string;
  readonly horizon?: GoalHorizon;
}

const EDIT_FIELDS = ['what', 'why', 'how', 'horizon'] as const;

function liveGoal(list: readonly RoleGoal[], id: string): RoleGoal | undefined {
  return list.find((goal) => goal.id === id && isLive(goal));
}

/** Whether `a` and `b` store the same fields; steps compare by value. */
function sameGoal(a: RoleGoal, b: RoleGoal): boolean {
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) =>
      key === 'steps'
        ? JSON.stringify(left[key]) === JSON.stringify(right[key])
        : left[key] === right[key],
    )
  );
}

/** Replaces the live goal `id` with `change(goal)`, tidied, without `sample` (any edit makes an
 * example the user's own) and with `updatedAt` bumped; `list` itself when nothing changed or `id`
 * isn't a live goal. */
function changeGoal(
  list: readonly RoleGoal[],
  id: string,
  now: Date,
  change: (goal: RoleGoal) => RoleGoal,
): readonly RoleGoal[] {
  const target = liveGoal(list, id);
  if (!target) {
    return list;
  }
  const changed = tidyGoal(change(target));
  if (sameGoal(changed, tidyGoal(target))) {
    return list;
  }
  return list.map((goal) => (goal === target ? touch(withoutSample(changed), now) : goal));
}

/** Edits the goal `id`. A blank `what` and an unknown horizon are ignored, so the last valid value
 * stays. */
export function editGoal(
  list: readonly RoleGoal[],
  id: string,
  edit: GoalEdit,
  now: Date,
): readonly RoleGoal[] {
  const allowed: Record<string, unknown> = {};
  for (const key of EDIT_FIELDS) {
    if (!(key in edit)) {
      continue;
    }
    if (key === 'what' && (edit.what ?? '').trim() === '') {
      continue;
    }
    if (key === 'horizon' && !isGoalHorizon(edit.horizon)) {
      continue;
    }
    allowed[key] = edit[key];
  }
  return changeGoal(list, id, now, (goal) => ({ ...goal, ...allowed }) as RoleGoal);
}

/** Marks the goal `id` Reached or Dropped on `today` (`YYYY-MM-DD`). */
export function setGoalStatus(
  list: readonly RoleGoal[],
  id: string,
  status: 'reached' | 'dropped',
  today: string,
  now: Date,
): readonly RoleGoal[] {
  return changeGoal(list, id, now, (goal) =>
    goal.status === status ? goal : { ...goal, status, resolvedOn: today },
  );
}

/** Makes the goal `id` open again, clearing its resolved date. */
export function reopenGoal(list: readonly RoleGoal[], id: string, now: Date): readonly RoleGoal[] {
  return changeGoal(list, id, now, (goal) => ({ ...goal, status: 'open', resolvedOn: undefined }));
}

/** Appends an empty step with `key`; refused at `MAX_GOAL_STEPS`. */
export function addStep(
  list: readonly RoleGoal[],
  id: string,
  key: string,
  now: Date,
): readonly RoleGoal[] {
  return changeGoal(list, id, now, (goal) =>
    goal.steps.length >= MAX_GOAL_STEPS || goal.steps.some((step) => step.key === key)
      ? goal
      : { ...goal, steps: [...goal.steps, { key, text: '', done: false }] },
  );
}

function changeStep(
  list: readonly RoleGoal[],
  id: string,
  key: string,
  now: Date,
  change: (step: GoalStep) => GoalStep,
): readonly RoleGoal[] {
  return changeGoal(list, id, now, (goal) => ({
    ...goal,
    steps: goal.steps.map((step) => (step.key === key ? change(step) : step)),
  }));
}

export function editStep(
  list: readonly RoleGoal[],
  id: string,
  key: string,
  text: string,
  now: Date,
): readonly RoleGoal[] {
  return changeStep(list, id, key, now, (step) => ({ ...step, text }));
}

export function toggleStep(
  list: readonly RoleGoal[],
  id: string,
  key: string,
  done: boolean,
  now: Date,
): readonly RoleGoal[] {
  return changeStep(list, id, key, now, (step) => ({ ...step, done }));
}

export function removeStep(
  list: readonly RoleGoal[],
  id: string,
  key: string,
  now: Date,
): readonly RoleGoal[] {
  return changeGoal(list, id, now, (goal) =>
    goal.steps.some((step) => step.key === key)
      ? { ...goal, steps: goal.steps.filter((step) => step.key !== key) }
      : goal,
  );
}

/** Tombstones the goal `id`; `list` itself for an unknown or deleted id. */
export function removeGoal(list: readonly RoleGoal[], id: string, now: Date): readonly RoleGoal[] {
  const target = liveGoal(list, id);
  return target ? list.map((goal) => (goal === target ? softDelete(goal, now) : goal)) : list;
}

/** Undoes `removeGoal()`; `list` itself when `id` isn't tombstoned. */
export function restoreGoal(list: readonly RoleGoal[], id: string, now: Date): readonly RoleGoal[] {
  if (!list.some((goal) => goal.id === id && !isLive(goal))) {
    return list;
  }
  return list.map((goal) =>
    goal.id === id && !isLive(goal)
      ? touch(tidyGoal({ ...goal, deletedAt: undefined }), now)
      : goal,
  );
}

/** Tombstones every live goal of `roleId` at `now`, the role's own `deletedAt`, so
 * `restoreGoalsForRole()` brings back exactly these and not a goal deleted on its own earlier. */
export function removeGoalsForRole(
  list: readonly RoleGoal[],
  roleId: string,
  now: Date,
): readonly RoleGoal[] {
  if (!list.some((goal) => goal.roleId === roleId && isLive(goal))) {
    return list;
  }
  return list.map((goal) =>
    goal.roleId === roleId && isLive(goal) ? softDelete(goal, now) : goal,
  );
}

/** Undoes `removeGoalsForRole()`: restores the goals of `roleId` tombstoned at `deletedAt`. */
export function restoreGoalsForRole(
  list: readonly RoleGoal[],
  roleId: string,
  deletedAt: string,
  now: Date,
): readonly RoleGoal[] {
  const matches = (goal: RoleGoal): boolean =>
    goal.roleId === roleId && goal.deletedAt === deletedAt;
  if (!list.some(matches)) {
    return list;
  }
  return list.map((goal) =>
    matches(goal) ? touch(tidyGoal({ ...goal, deletedAt: undefined }), now) : goal,
  );
}
