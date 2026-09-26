import { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import { MissionRoleLine } from '../../shared/mission/mission.model';
import { hasLine, normaliseLine, sameLine } from '../../shared/mission/mission.logic';

/** A suggestion chip in steps 1–2: pressed while its text is in the record. */
export interface SuggestionRow {
  readonly text: string;
  readonly pressed: boolean;
}

/** The source's items as suggestion chips, one per distinct text (case-insensitive). */
export function suggestionRows(
  items: readonly MissionInputItem[],
  kept: readonly string[],
): readonly SuggestionRow[] {
  const rows: SuggestionRow[] = [];
  for (const item of items) {
    const text = normaliseLine(item.text);
    if (text !== '' && !rows.some((row) => sameLine(row.text, text))) {
      rows.push({ text, pressed: hasLine(kept, text) });
    }
  }
  return rows;
}

/** A kept line that no suggestion offers: the user's own words, removable from the chip grid. */
export interface OwnLine {
  readonly text: string;
  /** Its index in the record's list, what `MissionService.removeLine()` takes. */
  readonly index: number;
}

export function ownLines(
  kept: readonly string[],
  suggestions: readonly SuggestionRow[],
): readonly OwnLine[] {
  return kept
    .map((text, index) => ({ text, index }))
    .filter((line) => !suggestions.some((row) => sameLine(row.text, line.text)));
}

/** A role row of step 3. `label` is `null` for a deleted role (shown as "Deleted role"). */
export interface RoleLineRow {
  readonly roleId: string;
  readonly label: string | null;
  readonly text: string;
}

/**
 * One row per active role, in the roles' order, then any written line whose role is no longer
 * active (archived or deleted), so a line is never hidden with its text still in the statement's
 * inputs. `labelOf` returns a role's label, or `null` once it is deleted.
 */
export function roleLineRows(
  active: readonly { readonly id: string; readonly label: string }[],
  lines: readonly MissionRoleLine[],
  labelOf: (roleId: string) => string | null,
): readonly RoleLineRow[] {
  const textOf = (roleId: string): string =>
    lines.find((line) => line.roleId === roleId)?.text ?? '';
  const rows: RoleLineRow[] = active.map((role) => ({
    roleId: role.id,
    label: role.label,
    text: textOf(role.id),
  }));
  for (const line of lines) {
    if (line.text.trim() !== '' && !active.some((role) => role.id === line.roleId)) {
      rows.push({ roleId: line.roleId, label: labelOf(line.roleId), text: line.text });
    }
  }
  return rows;
}

/** The kinds an inspiration item can have, in filter order; labelled in this scope
 * (`panel.kind.*`), since a feature never provides another feature's scope (playbook §6). */
export const COLLECTION_KINDS = ['saying', 'thought', 'idea'] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

/** The panel's filter: `null` means "All" / no tag. */
export interface CollectionFilter {
  readonly kind: CollectionKind | null;
  readonly tag: string | null;
}

export const NO_COLLECTION_FILTER: CollectionFilter = { kind: null, tag: null };

const tagKey = (tag: string): string => normaliseLine(tag).toLocaleLowerCase();

/** The kinds present in `items`, in `COLLECTION_KINDS` order. */
export function collectionKinds(items: readonly MissionInputItem[]): readonly CollectionKind[] {
  return COLLECTION_KINDS.filter((kind) => items.some((item) => item.kind === kind));
}

/** The distinct tags present in `items`, normalised and sorted. */
export function collectionTags(items: readonly MissionInputItem[]): readonly string[] {
  const tags = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      if (tagKey(tag) !== '') {
        tags.add(tagKey(tag));
      }
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function filterCollection(
  items: readonly MissionInputItem[],
  filter: CollectionFilter,
): readonly MissionInputItem[] {
  return items.filter(
    (item) =>
      (filter.kind === null || item.kind === filter.kind) &&
      (filter.tag === null || (item.tags ?? []).some((tag) => tagKey(tag) === filter.tag)),
  );
}
