import { isLive } from '../../core/data/record';
import {
  ChecklistLabels,
  ChecklistMet,
  checklistItems,
  checklistLabels,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import {
  ExerciseListChip,
  ExerciseListItem,
} from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import { isCounted } from '../../shared/exercise-kit/sample-record.logic';
import {
  BuiltInRoleLabels,
  activeRoles,
  averageSatisfaction,
  isBuiltIn,
  isRating,
  RoleEdit,
  roleLabel,
} from '../../shared/roles/roles.logic';
import { Role, RoleColor, RoleFields } from '../../shared/roles/roles.model';

/** The page's own rules for the Roles exercise (issue #59). The shared, cross-habit rules (order,
 * built-in, edits) are in `shared/roles/roles.logic.ts`. */

/** Started once any counted role exists (issues #216, #232). */
export function isStarted(list: readonly Role[]): boolean {
  return list.some(isCounted);
}

/** Live, unarchived roles that aren't untouched guide examples: what the hub, the summary and the
 * gate count. */
export function countedRoles(list: readonly Role[]): Role[] {
  return activeRoles(list).filter(isCounted);
}

/** The hub's status text: "5 roles", `null` with none. */
export function hubStatus(list: readonly Role[]): ExerciseHubStatus | null {
  const count = countedRoles(list).length;
  return count > 0 ? { key: 'habits.exercises.h2-roles.roleCount', count } : null;
}

/** How many rated roles "Mark done" needs (issue #59). */
export const RATED_TO_FINISH = 3;

/** The three gate items (issue #59), in the order the user does them. */
export const CHECKLIST_KEYS = ['role', 'rated', 'note'] as const;
export type RolesChecklistKey = (typeof CHECKLIST_KEYS)[number];

const hasNote = (role: Role): boolean => (role.note ?? '').trim() !== '';

/** The gate is over the whole list, not one item: a role exists, `RATED_TO_FINISH` are rated and
 * one has a note. Both `isComplete()` and `doneChecklist()` reduce this one map, so the button and
 * its checklist never disagree. */
function checklistMet(list: readonly Role[]): ChecklistMet<RolesChecklistKey> {
  const counted = countedRoles(list);
  return {
    role: counted.length > 0,
    rated: counted.filter((role) => isRating(role.satisfaction)).length >= RATED_TO_FINISH,
    note: counted.some(hasNote),
  };
}

export function isComplete(list: readonly Role[]): boolean {
  const met = checklistMet(list);
  return CHECKLIST_KEYS.every((key) => met[key]);
}

export function doneChecklist(
  list: readonly Role[],
  labels: ChecklistLabels<RolesChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(list), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<RolesChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<RolesChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** "Your picture": `null` until a counted role exists, so the card never shows a zero. `average`
 * is `null` until one is rated. */
export interface RolesSummary {
  readonly count: number;
  readonly rated: number;
  readonly average: number | null;
}

export function summarize(list: readonly Role[]): RolesSummary | null {
  const counted = countedRoles(list);
  if (counted.length === 0) {
    return null;
  }
  return {
    count: counted.length,
    rated: counted.filter((role) => isRating(role.satisfaction)).length,
    average: averageSatisfaction(counted),
  };
}

/** Each palette key's paint. Decorative: the colour's name is always shown next to it. */
export const ROLE_SWATCHES: Readonly<Record<RoleColor, string>> = {
  red: '#d32f2f',
  orange: '#ef6c00',
  yellow: '#f9a825',
  green: '#2e7d32',
  teal: '#00897b',
  blue: '#1565c0',
  purple: '#6a1b9a',
  grey: '#757575',
};

/** The token `ratingLine()` replaces: the page translates `list.ratingText` with it as `value`.
 * No `{{…}}`: Transloco re-scans the interpolated value, so a braced token loops forever. */
export const VALUE_TOKEN = '@@value@@';

/** Already-translated text for a row, built by the page (playbook §6 "Reactive labels"). */
export interface RoleLabels {
  readonly builtIn: BuiltInRoleLabels;
  /** `list.builtIn`, the lock icon's hidden label. */
  readonly builtInText: string;
  readonly example: string;
  /** `list.ratingText` with `VALUE_TOKEN` still in it. */
  readonly ratingTemplate: string;
  /** Formats a number in the active numerals. */
  readonly formatNumber: (value: number) => string;
}

/** "3 of 5", or `''` when unrated or before the template has loaded. */
export function ratingLine(role: Pick<Role, 'satisfaction'>, labels: RoleLabels): string {
  return isRating(role.satisfaction) && labels.ratingTemplate
    ? labels.ratingTemplate.replace(VALUE_TOKEN, labels.formatNumber(role.satisfaction))
    : '';
}

/** A role as an `ExerciseList` row: its name (or the built-in label) as title; "3 of 5" and the
 * description as subtitle; a colour dot; a lock for the built-in, which can't be deleted. */
export function toListItem(role: Role, labels: RoleLabels): ExerciseListItem {
  const chips: ExerciseListChip[] = role.sample ? [{ label: labels.example }] : [];
  const builtIn = isBuiltIn(role);
  const subtitle = [ratingLine(role, labels), role.description?.trim() ?? '']
    .filter((part) => part !== '')
    .join(' · ');
  return {
    id: role.id,
    title: roleLabel(role, labels.builtIn),
    ...(subtitle ? { subtitle } : {}),
    ...(chips.length ? { chips } : {}),
    ...(role.color ? { swatch: ROLE_SWATCHES[role.color] } : {}),
    ...(builtIn ? { icon: 'lock', iconLabel: labels.builtInText, deletable: false } : {}),
  };
}

/** Draft before record (issue #217): a new role becomes a record on the first typed character of
 * its name. */
export function isDraftWorthSaving(draft: Pick<RoleFields, 'name'>): boolean {
  return (draft.name ?? '').trim() !== '';
}

/** A form edit as record fields, safe for the draft path, which merges fields as they come
 * (playbook §6's first pitfall): a cleared colour (`null`) becomes `undefined`, which every write
 * drops, never a `null` that `validate()` would reject on the next load. */
export function roleEditFields(edit: RoleEdit): Partial<RoleFields> {
  const { color, ...rest } = edit;
  return 'color' in edit ? { ...rest, color: color ?? undefined } : rest;
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** A guide example's `sample` payload (`{ name, description? }`) as a new role's fields, or `null`
 * when it isn't valid (the i18n JSON is an input boundary). */
export function roleFromExample(value: unknown): RoleFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const name = optionalText(example['name']);
  if (name === undefined) {
    return null;
  }
  const description = optionalText(example['description']);
  return { name, order: 0, ...(description === undefined ? {} : { description }) };
}

/** The live, untouched sample with this example's name, if the user already tried it: trying it
 * again opens that one instead of adding a copy (issue #232). */
export function liveSampleOf(
  list: readonly Role[],
  fields: Pick<RoleFields, 'name'>,
): Role | undefined {
  return list.find((role) => isLive(role) && role.sample && role.name === fields.name);
}
