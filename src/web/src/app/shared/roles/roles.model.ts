import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';

/** The built-in roles (issue #59): stored as a key, labelled from the `exercise-kit` scope
 * (`exerciseKit.roles.<key>`), never as text. `renewal` is Sharpen the Saw (Habit 7). */
export const BUILT_IN_ROLE_KEYS = ['renewal'] as const;
export type BuiltInRoleKey = (typeof BUILT_IN_ROLE_KEYS)[number];

/** A role's colour: a palette key, painted and named at render. */
export const ROLE_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'grey',
] as const;
export type RoleColor = (typeof ROLE_COLORS)[number];

/** "How it's going", 1 (not at all) to 5 (very). */
export type RoleSatisfaction = 1 | 2 | 3 | 4 | 5;

/**
 * One role the user plays (issue #59): the second `shared.*` entity, read by Habits 2, 3 and 7
 * and written only through `RolesService`. Exactly one of `name` (typed) and `key` (built-in) is
 * set, and `satisfaction` is 1–5; `validate()` checks neither (architecture issue #1 §6: structure,
 * not business rules).
 */
export interface Role extends BaseRecord {
  readonly name?: string;
  readonly key?: BuiltInRoleKey;
  readonly description?: string;
  readonly color?: RoleColor;
  /** 0-based position; the list sorts by it. */
  readonly order: number;
  /** Absent means `false`. */
  readonly archived?: boolean;
  readonly satisfaction?: RoleSatisfaction;
  /** "Is this the picture you want?" */
  readonly note?: string;
  /** A copy of a guide example ("Try this example", issue #232). Absent means `false`. */
  readonly sample?: boolean;
}

export type RoleFields = Omit<Role, keyof BaseRecord>;

/** The model key `featureStore<Role[]>()` resolves; the slice belongs to no single exercise. */
export const ROLES_MODEL_KEY = 'roles';

/** Architecture issue #1 §6: cross-habit entities live under `shared.*`. */
export const ROLES_PATH = 'shared.roles';

export const isBuiltInRoleKey = isOneOf(BUILT_IN_ROLE_KEYS);
export const isRoleColor = isOneOf(ROLE_COLORS);

function isRole(value: unknown): value is Role {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  const key = candidate['key'];
  const color = candidate['color'];
  const satisfaction = candidate['satisfaction'];
  return (
    isOptionalString(candidate['name']) &&
    (key === undefined || isBuiltInRoleKey(key)) &&
    isOptionalString(candidate['description']) &&
    (color === undefined || isRoleColor(color)) &&
    typeof candidate['order'] === 'number' &&
    isOptionalBoolean(candidate['archived']) &&
    (satisfaction === undefined || typeof satisfaction === 'number') &&
    isOptionalString(candidate['note']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isRoleArray = isArrayOf(isRole);

/**
 * Registers the `roles` model, a no-op if already done (Vitest runs with `isolate: false`).
 * Imported eagerly from `model-registry.ts`, not from a lazy route, so the slice is validated on
 * load and import even when the Roles page has never been opened (as `shared/commitments/`).
 */
export function registerRolesModel(): void {
  if (getRegisteredModels().some((model) => model.key === ROLES_MODEL_KEY)) {
    return;
  }
  registerModel<Role[]>({
    key: ROLES_MODEL_KEY,
    path: ROLES_PATH,
    defaults: () => [],
    validate: isRoleArray,
  });
}

registerRolesModel();
