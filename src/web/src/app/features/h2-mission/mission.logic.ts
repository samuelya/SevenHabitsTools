import { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import { MissionRoleLine } from '../../shared/mission/mission.model';
import { hasLine, normaliseLine, sameLine } from '../../shared/mission/mission.logic';

/** A suggestion chip in steps 1–2: pressed while its `value` is in the record. */
export interface SuggestionRow {
  /** What the record keeps: the item's `key` (a suggested principle, translated on render, #299)
   * or its normalised text (the user's own words from another exercise). */
  readonly value: string;
  /** What the chip shows: the item's text in the current language. */
  readonly text: string;
  readonly pressed: boolean;
}

/** The source's items as suggestion chips, one per distinct value (case-insensitive). */
export function suggestionRows(
  items: readonly MissionInputItem[],
  kept: readonly string[],
): readonly SuggestionRow[] {
  const rows: SuggestionRow[] = [];
  for (const item of items) {
    const text = normaliseLine(item.text);
    const value = item.key ?? text;
    if (text !== '' && !rows.some((row) => sameLine(row.value, value))) {
      rows.push({ value, text, pressed: hasLine(kept, value) });
    }
  }
  return rows;
}

/** One source's suggestion chips, labelled by its root `titles.<sourceExerciseId>` short title. */
export interface SuggestionGroup {
  readonly sourceExerciseId: string;
  readonly rows: readonly SuggestionRow[];
}

/**
 * Each source's items as a group of suggestion chips, in registration order. A text an earlier
 * source already offers isn't repeated, and a source left with no rows is dropped.
 */
export function suggestionGroups(
  sources: readonly {
    readonly sourceExerciseId: string;
    readonly items: readonly MissionInputItem[];
  }[],
  kept: readonly string[],
): readonly SuggestionGroup[] {
  const groups: SuggestionGroup[] = [];
  const offered: SuggestionRow[] = [];
  for (const source of sources) {
    const rows = suggestionRows(source.items, kept).filter(
      (row) => !offered.some((earlier) => sameLine(earlier.value, row.value)),
    );
    offered.push(...rows);
    if (rows.length > 0) {
      groups.push({ sourceExerciseId: source.sourceExerciseId, rows });
    }
  }
  return groups;
}

/** A kept line that no suggestion offers: the user's own words, removable from the chip grid. */
export interface OwnLine {
  /** What the chip shows: `labelOf(line)`, the line as typed unless it is a suggestion's key. */
  readonly text: string;
  /** Its index in the record's list, what `MissionService.removeLine()` takes. */
  readonly index: number;
}

export function ownLines(
  kept: readonly string[],
  suggestions: readonly SuggestionRow[],
  labelOf: (line: string) => string = (line) => line,
): readonly OwnLine[] {
  return kept
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !suggestions.some((row) => sameLine(row.value, line)))
    .map(({ line, index }) => ({ text: labelOf(line), index }));
}

/** A kept principle's label (issue #61's contract): a suggestion's key translated through
 * `exerciseKit.principle.*` (`keyLabels`), anything else as typed. A key whose label hasn't
 * loaded yet shows as stored. */
export function principleLineLabel(
  line: string,
  keyLabels: Readonly<Record<string, string>>,
): string {
  return Object.prototype.hasOwnProperty.call(keyLabels, line) && keyLabels[line] !== ''
    ? keyLabels[line]
    : line;
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
 *
 * `shown` is the row ids already on screen during this visit to the step: they keep their place
 * and stay listed even once their role leaves `active` or their line is cleared, so a row never
 * disappears or moves under the user mid-edit (#298 finding 3). Rows not yet shown follow them.
 */
export function roleLineRows(
  active: readonly { readonly id: string; readonly label: string }[],
  lines: readonly MissionRoleLine[],
  labelOf: (roleId: string) => string | null,
  shown: readonly string[] = [],
): readonly RoleLineRow[] {
  const textOf = (roleId: string): string =>
    lines.find((line) => line.roleId === roleId)?.text ?? '';
  const labelFor = (roleId: string): string | null =>
    active.find((role) => role.id === roleId)?.label ?? labelOf(roleId);
  const ids = [
    ...shown,
    ...active.map((role) => role.id),
    ...lines.filter((line) => line.text.trim() !== '').map((line) => line.roleId),
  ];
  return [...new Set(ids)].map((roleId) => ({
    roleId,
    label: labelFor(roleId),
    text: textOf(roleId),
  }));
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
