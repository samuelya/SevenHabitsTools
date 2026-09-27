import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { isValidIsoDate } from '../exercise-kit/assessment-history.logic';

/** When a goal is for: stored as a key, translated at render (`h2Roles.horizon.<key>`). */
export const GOAL_HORIZONS = ['year', 'threeYears', 'fiveYears', 'lifetime'] as const;
export type GoalHorizon = (typeof GOAL_HORIZONS)[number];

export const GOAL_STATUSES = ['open', 'reached', 'dropped'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** One first step: a value object edited only through its goal, `key` for `track`. */
export interface GoalStep {
  readonly key: string;
  readonly text: string;
  readonly done: boolean;
}

/**
 * A long-term goal for one role (issue #291), read by the weekly planner (#71) through
 * `RoleGoalsService.openSteps()` and written only through `RoleGoalsService`. `what` is required
 * by the form and `steps` holds at most `MAX_GOAL_STEPS`; `validate()` checks neither (architecture
 * issue #1 §6: structure, not business rules).
 */
export interface RoleGoal extends BaseRecord {
  /** The id of a role in `shared.roles`. */
  readonly roleId: string;
  /** What you want to reach. */
  readonly what: string;
  /** Why it matters. */
  readonly why?: string;
  /** How you'll know. */
  readonly how?: string;
  readonly horizon: GoalHorizon;
  readonly status: GoalStatus;
  /** The local date (`YYYY-MM-DD`) it was marked Reached or Dropped; absent while open. */
  readonly resolvedOn?: string;
  readonly steps: readonly GoalStep[];
  /** A copy of a guide example ("Try this example", issue #232). Absent means `false`. */
  readonly sample?: boolean;
  /** Set with `deletedAt` when the goal was deleted with its role (the role's id), so undoing the
   * role's delete brings back exactly those goals; absent on a live goal. */
  readonly deletedWithRole?: string;
}

export type RoleGoalFields = Omit<RoleGoal, keyof BaseRecord>;

export const ROLE_GOALS_MODEL_KEY = 'h2-role-goals';

export const ROLE_GOALS_PATH = 'habits.h2.roleGoals';

export const isGoalHorizon = isOneOf(GOAL_HORIZONS);
export const isGoalStatus = isOneOf(GOAL_STATUSES);

function isGoalStep(value: unknown): value is GoalStep {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const step = value as Record<string, unknown>;
  return (
    typeof step['key'] === 'string' &&
    typeof step['text'] === 'string' &&
    typeof step['done'] === 'boolean'
  );
}

const isGoalStepArray = isArrayOf(isGoalStep);

function isRoleGoal(value: unknown): value is RoleGoal {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  const resolvedOn = candidate['resolvedOn'];
  return (
    typeof candidate['roleId'] === 'string' &&
    typeof candidate['what'] === 'string' &&
    isOptionalString(candidate['why']) &&
    isOptionalString(candidate['how']) &&
    isGoalHorizon(candidate['horizon']) &&
    isGoalStatus(candidate['status']) &&
    (resolvedOn === undefined || (typeof resolvedOn === 'string' && isValidIsoDate(resolvedOn))) &&
    isGoalStepArray(candidate['steps']) &&
    isOptionalBoolean(candidate['sample']) &&
    isOptionalString(candidate['deletedWithRole'])
  );
}

const isRoleGoalArray = isArrayOf(isRoleGoal);

/**
 * Registers the `h2-role-goals` model, a no-op if already done (Vitest runs with `isolate: false`).
 * Imported eagerly from `model-registry.ts`, next to `roles.model.ts`, because Habit 3's planner
 * reads the steps whether or not the Roles page was ever opened.
 */
export function registerRoleGoalsModel(): void {
  if (getRegisteredModels().some((model) => model.key === ROLE_GOALS_MODEL_KEY)) {
    return;
  }
  registerModel<RoleGoal[]>({
    key: ROLE_GOALS_MODEL_KEY,
    path: ROLE_GOALS_PATH,
    defaults: () => [],
    validate: isRoleGoalArray,
  });
}

registerRoleGoalsModel();
