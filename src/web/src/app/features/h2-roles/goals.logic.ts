import { isLive } from '../../core/data/record';
import { GoalEdit, MAX_GOAL_STEPS } from '../../shared/roles/role-goals.logic';
import {
  GoalStep,
  RoleGoal,
  RoleGoalFields,
  isGoalHorizon,
} from '../../shared/roles/role-goals.model';
import { activeRoles, archivedRoles } from '../../shared/roles/roles.logic';
import { Role, RoleFields } from '../../shared/roles/roles.model';
import { roleFromExample } from './roles.logic';

/** The page's own rules for goals (issue #291). The shared ones (steps, status, edits) are in
 * `shared/roles/role-goals.logic.ts`. */

/** Draft before record (issue #217): a new goal becomes a record on the first typed character of
 * "What you want to reach". */
export function isGoalDraftWorthSaving(draft: Pick<RoleGoal, 'what'>): boolean {
  return draft.what.trim() !== '';
}

/** A guide example goal (issue #291): the role it belongs to and the goal's own fields. */
export interface GoalExample {
  readonly role: RoleFields;
  readonly goal: Omit<RoleGoalFields, 'roleId'>;
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

function stepsFrom(value: unknown, newKey: () => string): GoalStep[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .flatMap((item: unknown) => {
      if (typeof item !== 'object' || item === null) {
        return [];
      }
      const text = optionalText((item as Record<string, unknown>)['text']);
      return text === undefined ? [] : [{ key: newKey(), text, done: false }];
    })
    .slice(0, MAX_GOAL_STEPS);
}

/** A guide example's `sample` payload (`{ role: { name, description? }, what, why?, how?,
 * horizon?, steps? }`) as a role and a goal, or `null` when it isn't a goal example (the i18n JSON
 * is an input boundary). `newKey` gives each step its key. */
export function goalFromExample(value: unknown, newKey: () => string): GoalExample | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const what = optionalText(example['what']);
  const role = roleFromExample(example['role']);
  if (what === undefined || role === null) {
    return null;
  }
  const why = optionalText(example['why']);
  const how = optionalText(example['how']);
  return {
    role,
    goal: {
      what,
      ...(why === undefined ? {} : { why }),
      ...(how === undefined ? {} : { how }),
      horizon: isGoalHorizon(example['horizon']) ? example['horizon'] : 'year',
      status: 'open',
      steps: stepsFrom(example['steps'], newKey),
    },
  };
}

/** The live role named `name` a goal example attaches to (the user's own or a sample), if any: an
 * active one first, else an archived one, so trying the example never adds a second "Dad". */
export function roleNamed(roles: readonly Role[], name: string | undefined): Role | undefined {
  const named = (role: Role): boolean => role.name === name;
  return activeRoles(roles).find(named) ?? archivedRoles(roles).find(named);
}

/** The live, untouched sample goal of `roleId` with this `what`, if the user already tried it: trying
 * it again opens that one instead of adding a copy (issue #232). */
export function liveSampleGoalOf(
  goals: readonly RoleGoal[],
  roleId: string,
  what: string,
): RoleGoal | undefined {
  return goals.find(
    (goal) => isLive(goal) && goal.sample && goal.roleId === roleId && goal.what === what,
  );
}

/** What the goal editor asks the page to do to one goal; the page applies it through
 * `RoleGoalsService` (or the goal draft). */
export type GoalAction =
  | { readonly kind: 'edit'; readonly edit: GoalEdit }
  | { readonly kind: 'status'; readonly status: 'reached' | 'dropped' }
  | { readonly kind: 'reopen' }
  | { readonly kind: 'addStep' }
  | { readonly kind: 'editStep'; readonly key: string; readonly text: string }
  | { readonly kind: 'toggleStep'; readonly key: string; readonly done: boolean }
  | { readonly kind: 'removeStep'; readonly key: string }
  | { readonly kind: 'delete' };

/** A `GoalAction` for the goal `goalId`, as the goals section emits it. */
export interface GoalActionEvent {
  readonly goalId: string;
  readonly action: GoalAction;
}
