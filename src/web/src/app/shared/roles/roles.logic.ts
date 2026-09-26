import { isLive, newRecord, softDelete, touch } from '../../core/data/record';
import { withoutSample } from '../exercise-kit/sample-record.logic';
import { BuiltInRoleKey, Role, RoleColor, RoleSatisfaction } from './roles.model';

/**
 * The shared, pure half of `shared.roles` (issue #59): what Habits 2, 3 and 7 read, plus the array
 * edits `RolesService` applies. Time comes in as `now` (from `CLOCK`), never read here.
 */

/** More live, unarchived roles than this earns the "hard to hold in your head" hint. */
export const MAX_COMFORTABLE_ROLES = 7;

/** The one built-in role every user gets with their first role: Sharpen the Saw (Habit 7). */
export const RENEWAL_ROLE_KEY: BuiltInRoleKey = 'renewal';

export type RoleDirection = 'up' | 'down';

/** Translated built-in labels by key (`exerciseKit.roles.<key>`), built by the caller. */
export type BuiltInRoleLabels = Readonly<Partial<Record<BuiltInRoleKey, string>>>;

/** Live roles by `order` (ties by creation time, so an imported duplicate order stays stable). */
export function sortedRoles(list: readonly Role[]): Role[] {
  return list
    .filter(isLive)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

/** Live roles that aren't archived, by `order`. */
export function activeRoles(list: readonly Role[]): Role[] {
  return sortedRoles(list).filter((role) => !role.archived);
}

/** Live archived roles, by `order`. */
export function archivedRoles(list: readonly Role[]): Role[] {
  return sortedRoles(list).filter((role) => role.archived === true);
}

export function isBuiltIn(role: Pick<Role, 'key'>): boolean {
  return role.key !== undefined;
}

/** The role's name, or its translated built-in label; `''` before the label has loaded
 * (playbook §6). */
export function roleLabel(
  role: Pick<Role, 'name' | 'key'>,
  builtInLabels: BuiltInRoleLabels,
): string {
  return role.key !== undefined ? (builtInLabels[role.key] ?? '') : (role.name ?? '');
}

/** The `order` a new role takes: after every live role. */
export function nextOrder(list: readonly Role[]): number {
  const live = list.filter(isLive);
  return live.length ? Math.max(...live.map((role) => role.order)) + 1 : 0;
}

/** Mean satisfaction of the rated live roles in `list`, or `null` when none is rated. */
export function averageSatisfaction(list: readonly Role[]): number | null {
  const rated = list
    .filter(isLive)
    .flatMap((role) => (isRating(role.satisfaction) ? [role.satisfaction] : []));
  return rated.length ? rated.reduce((sum, value) => sum + value, 0) / rated.length : null;
}

/** More than `MAX_COMFORTABLE_ROLES` live, unarchived roles. */
export function tooMany(list: readonly Role[]): boolean {
  return activeRoles(list).length > MAX_COMFORTABLE_ROLES;
}

export function isRating(value: unknown): value is RoleSatisfaction {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** The live built-in role with `key`, if any. */
export function builtInRole(
  list: readonly Role[],
  key: BuiltInRoleKey = RENEWAL_ROLE_KEY,
): Role | undefined {
  return list.find((role) => isLive(role) && role.key === key);
}

/** `list` with the live renewal role guaranteed, created at order 0 (every other live role moves
 * down one) when missing, and its id. Idempotent: an existing one is returned as is. */
export function withBuiltIn(list: readonly Role[], now: Date): { list: Role[]; id: string } {
  const existing = builtInRole(list);
  if (existing) {
    return { list: [...list], id: existing.id };
  }
  const created: Role = newRecord({ key: RENEWAL_ROLE_KEY, order: 0 }, now);
  const shifted = list.map((role) =>
    isLive(role) ? touch({ ...role, order: role.order + 1 }, now) : role,
  );
  return { list: [...shifted, created], id: created.id };
}

/** Optional text fields an empty string clears. */
const CLEARABLE_FIELDS: readonly string[] = ['description', 'note'];

/** `role` as it is stored: no `undefined` value, no cleared (`''`) description or note, no
 * `archived: false`, no name on a built-in and no satisfaction outside 1–5. Every write goes
 * through it. */
export function tidyRole(role: Role): Role {
  return Object.fromEntries(
    Object.entries(role).filter(
      ([key, value]) =>
        value !== undefined &&
        !(value === '' && CLEARABLE_FIELDS.includes(key)) &&
        !(key === 'archived' && value === false) &&
        !(key === 'name' && role.key !== undefined) &&
        !(key === 'satisfaction' && !isRating(value)),
    ),
  ) as unknown as Role;
}

/** Appends `record` after every live role. A counted (non-sample) role brings the built-in with
 * it, so the first role the user adds also creates Sharpen the Saw (issue #59, decision Q4). */
export function insertRole(list: readonly Role[], record: Role, now: Date): Role[] {
  const base = record.sample ? [...list] : withBuiltIn(list, now).list;
  return [...base, tidyRole({ ...record, order: nextOrder(base) })];
}

/** What `update()` may change. `color: null` clears the colour; `''` clears a text field. */
export interface RoleEdit {
  readonly name?: string;
  readonly description?: string;
  readonly color?: RoleColor | null;
  readonly satisfaction?: RoleSatisfaction;
  readonly note?: string;
}

const EDIT_FIELDS = ['name', 'description', 'color', 'satisfaction', 'note'] as const;

/** Applies `change` to the live role `id` and bumps `updatedAt`; `null` from `change` leaves the
 * list as is. Tombstoned or missing ids are left alone. */
function changeOne(
  list: readonly Role[],
  id: string,
  now: Date,
  change: (role: Role) => Role | null,
): Role[] {
  return list.map((role) => {
    if (role.id !== id || !isLive(role)) {
      return role;
    }
    const changed = change(role);
    return changed === null ? role : touch(tidyRole(changed), now);
  });
}

/** Edits the role `id`. A built-in keeps its name (no rename). Any edit makes a sample the user's
 * own (issue #232), and so brings the built-in with it, as `insertRole()` does. */
export function editRole(list: readonly Role[], id: string, edit: RoleEdit, now: Date): Role[] {
  const target = list.find((role) => role.id === id && isLive(role));
  if (!target) {
    return [...list];
  }
  const allowed: Record<string, unknown> = {};
  for (const key of EDIT_FIELDS) {
    if (key in edit && !(key === 'name' && isBuiltIn(target))) {
      allowed[key] = key === 'color' && edit.color === null ? undefined : edit[key];
    }
  }
  if (Object.keys(allowed).length === 0) {
    return [...list];
  }
  const base = target.sample ? withBuiltIn(list, now).list : list;
  return changeOne(base, id, now, (role) => withoutSample({ ...role, ...allowed } as Role));
}

/** Archives or unarchives the role `id`; refused (list unchanged) for a built-in. */
export function setArchived(
  list: readonly Role[],
  id: string,
  archived: boolean,
  now: Date,
): Role[] {
  return changeOne(list, id, now, (role) =>
    isBuiltIn(role) || (role.archived ?? false) === archived ? null : { ...role, archived },
  );
}

/** The live role `id`'s neighbour in `direction` within its own group (active or archived), or
 * `undefined` at the edge. */
function neighbour(list: readonly Role[], id: string, direction: RoleDirection): Role | undefined {
  const role = list.find((r) => r.id === id && isLive(r));
  if (!role) {
    return undefined;
  }
  const group = role.archived ? archivedRoles(list) : activeRoles(list);
  const index = group.findIndex((r) => r.id === id);
  return group[direction === 'up' ? index - 1 : index + 1];
}

export function canMove(list: readonly Role[], id: string, direction: RoleDirection): boolean {
  return neighbour(list, id, direction) !== undefined;
}

/** Swaps the role `id` with its neighbour in `direction`. Orders are first renumbered 0…n-1 in
 * sorted order, so duplicates from an import can't make the swap a no-op; only roles whose order
 * actually changes are touched. */
export function reorder(
  list: readonly Role[],
  id: string,
  direction: RoleDirection,
  now: Date,
): Role[] {
  const other = neighbour(list, id, direction);
  if (!other) {
    return [...list];
  }
  const orders = new Map(sortedRoles(list).map((role, index) => [role.id, index]));
  const mine = orders.get(id)!;
  orders.set(id, orders.get(other.id)!);
  orders.set(other.id, mine);
  return list.map((role) => {
    const order = orders.get(role.id);
    return order === undefined || order === role.order ? role : touch({ ...role, order }, now);
  });
}

/** Tombstones the role `id`; refused for a built-in. */
export function removeRole(list: readonly Role[], id: string, now: Date): Role[] {
  return list.map((role) => (role.id === id && !isBuiltIn(role) ? softDelete(role, now) : role));
}

/** Undoes `removeRole()`. */
export function restoreRole(list: readonly Role[], id: string, now: Date): Role[] {
  return list.map((role) =>
    role.id === id && !isLive(role)
      ? touch(tidyRole({ ...role, deletedAt: undefined }), now)
      : role,
  );
}

/** The live role `id`, archived included, or `null` once deleted or if unknown. */
export function findRole(list: readonly Role[], id: string): Role | null {
  return list.find((role) => role.id === id && isLive(role)) ?? null;
}
