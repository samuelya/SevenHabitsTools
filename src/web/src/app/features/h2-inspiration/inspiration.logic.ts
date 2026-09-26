import { isLive, softDelete, touch } from '../../core/data/record';
import {
  ChecklistLabels,
  ChecklistMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import { ExerciseListItem } from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import { isCounted, withoutSample } from '../../shared/exercise-kit/sample-record.logic';
import type { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import {
  INSPIRATION_KINDS,
  Inspiration,
  InspirationFields,
  InspirationKind,
  isInspirationKind,
} from './inspiration.model';

const hasText = (value: string | undefined): boolean => (value ?? '').trim() !== '';

// ---- Tags: one normalisation rule for every writer and reader ----

/** A tag as stored and compared: trimmed, inner whitespace collapsed, lowercased. */
export function normaliseTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** `tags` normalised, blanks dropped, duplicates removed (first kept). */
export function normaliseTags(tags: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normal = normaliseTag(tag);
    if (normal !== '') {
      seen.add(normal);
    }
  }
  return [...seen];
}

/** An item's tags as every reader sees them (an imported document may hold un-normalised ones). */
export function itemTags(item: Pick<Inspiration, 'tags'>): readonly string[] {
  return normaliseTags(item.tags);
}

/** Whether `raw` names a tag `tags` already has: an add `addTag()` refuses, which keeps the text
 * in the field and says why. */
export function isDuplicateTag(tags: readonly string[], raw: string): boolean {
  const normal = normaliseTag(raw);
  return normal !== '' && normaliseTags(tags).includes(normal);
}

/** `tags` with `raw` added (normalised); the same array when `raw` is blank or already there. */
export function addTag(tags: readonly string[], raw: string): readonly string[] {
  const normal = normaliseTag(raw);
  if (normal === '' || isDuplicateTag(tags, normal)) {
    return tags;
  }
  return [...normaliseTags(tags), normal];
}

/** `tags` without `tag`; the same array when it isn't there. */
export function removeTag(tags: readonly string[], tag: string): readonly string[] {
  const normal = normaliseTag(tag);
  const next = normaliseTags(tags).filter((existing) => existing !== normal);
  return next.length === tags.length && next.every((t, i) => t === tags[i]) ? tags : next;
}

/** Every distinct tag on a live item, sorted: the filter's options and the autocomplete's. */
export function allTags(list: readonly Inspiration[]): readonly string[] {
  return normaliseTags(list.filter(isLive).flatMap(itemTags))
    .slice()
    .sort((a, b) => a.localeCompare(b));
}

/** The autocomplete's options for one item: every tag in use but its own, containing `typed`. */
export function tagSuggestions(
  used: readonly string[],
  own: readonly string[],
  typed: string,
): readonly string[] {
  const query = normaliseTag(typed);
  const mine = new Set(normaliseTags(own));
  return used.filter((tag) => !mine.has(tag) && tag.includes(query));
}

// ---- Counting, hub and gate ----

/** Live items that count (samples don't; issue #232). */
export function countedItems(list: readonly Inspiration[]): Inspiration[] {
  return list.filter(isCounted);
}

export function isStarted(list: readonly Inspiration[]): boolean {
  return list.some(isCounted);
}

/** "7 collected"; `null` with none. */
export function hubStatus(list: readonly Inspiration[]): ExerciseHubStatus | null {
  const count = countedItems(list).length;
  return count > 0 ? { key: 'habits.exercises.h2-inspiration.collectedCount', count } : null;
}

/** An item is complete once it has its line and a tag (issue #63's data model). */
export function isItemComplete(item: Pick<Inspiration, 'text' | 'tags'>): boolean {
  return hasText(item.text) && itemTags(item).length > 0;
}

/** Draft before record (issue #217): typed text in the line or its source. A kind, a tag or the
 * star alone keep it a draft. */
export function isDraftWorthSaving(draft: Pick<InspirationFields, 'text' | 'source'>): boolean {
  return hasText(draft.text) || hasText(draft.source);
}

/** How many counted items "Mark done" needs (issue #63). */
export const ITEMS_TO_FINISH = 3;

/** The gate items: the three the issue names, described on the item closest to them
 * (`closestMet()`), plus the count. */
export const CHECKLIST_KEYS = ['line', 'source', 'tag', 'three'] as const;
export type InspirationChecklistKey = (typeof CHECKLIST_KEYS)[number];

type ItemKey = Exclude<InspirationChecklistKey, 'three'>;
const ITEM_KEYS: readonly ItemKey[] = ['line', 'source', 'tag'];

function itemMet(item: Inspiration): ChecklistMet<ItemKey> {
  return {
    line: hasText(item.text),
    source: hasText(item.source),
    tag: itemTags(item).length > 0,
  };
}

/** One map for the button and its checklist, so the two never disagree. */
function checklistMet(list: readonly Inspiration[]): ChecklistMet<InspirationChecklistKey> {
  const counted = countedItems(list);
  return {
    ...closestMet(counted, ITEM_KEYS, itemMet),
    three: counted.length >= ITEMS_TO_FINISH,
  };
}

export function isComplete(list: readonly Inspiration[]): boolean {
  const met = checklistMet(list);
  return CHECKLIST_KEYS.every((key) => met[key]);
}

export function doneChecklist(
  list: readonly Inspiration[],
  labels: ChecklistLabels<InspirationChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(list), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<InspirationChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<InspirationChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** The summary card: `null` until a counted item exists, so it never shows a zero. */
export interface InspirationSummary {
  readonly count: number;
  readonly favourites: number;
}

export function summarize(list: readonly Inspiration[]): InspirationSummary | null {
  const counted = countedItems(list);
  return counted.length === 0
    ? null
    : { count: counted.length, favourites: counted.filter((item) => item.favourite).length };
}

// ---- Filters ----

export interface InspirationFilter {
  /** `null`: every kind. */
  readonly kind: InspirationKind | null;
  /** `null`: any tag. Compared normalised. */
  readonly tag: string | null;
  readonly favouritesOnly: boolean;
  /** Matched against the text and the source, case-insensitively. */
  readonly query: string;
}

export const NO_FILTER: InspirationFilter = {
  kind: null,
  tag: null,
  favouritesOnly: false,
  query: '',
};

/** The live items `filter` lets through, in list order. */
export function filtered(list: readonly Inspiration[], filter: InspirationFilter): Inspiration[] {
  const tag = filter.tag === null ? null : normaliseTag(filter.tag);
  const query = filter.query.trim().toLowerCase();
  return list.filter(
    (item) =>
      isLive(item) &&
      (filter.kind === null || item.kind === filter.kind) &&
      (!filter.favouritesOnly || item.favourite === true) &&
      (tag === null || itemTags(item).includes(tag)) &&
      (query === '' ||
        item.text.toLowerCase().includes(query) ||
        (item.source ?? '').toLowerCase().includes(query)),
  );
}

/** Whether any filter narrows the list (the list then says "Nothing matches", not "Nothing yet"). */
export function isFiltering(filter: InspirationFilter): boolean {
  return (
    filter.kind !== null ||
    filter.tag !== null ||
    filter.favouritesOnly ||
    filter.query.trim() !== ''
  );
}

// ---- Rows ----

/** Already-translated labels, built by the page from `translateSignal` (playbook §6). */
export interface InspirationLabels {
  readonly kind: Readonly<Record<InspirationKind, string>>;
  readonly example: string;
  readonly favourite: string;
  readonly unfavourite: string;
}

/** Builds the labels, `''` for any index `translateSignal` hasn't filled yet (it starts at
 * `['']`, playbook §6). */
export function labelsFrom(
  kindLabels: readonly (string | undefined)[],
  example: string | undefined,
  favourite: string | undefined,
  unfavourite: string | undefined,
): InspirationLabels {
  return {
    kind: Object.fromEntries(
      INSPIRATION_KINDS.map((kind, index) => [kind, kindLabels[index] ?? '']),
    ) as Record<InspirationKind, string>,
    example: example ?? '',
    favourite: favourite ?? '',
    unfavourite: unfavourite ?? '',
  };
}

/** A row: the line as title (the list clamps it at two lines), kind and source as subtitle, an
 * "Example" chip on a sample, and the favourite star at the inline end. */
export function toListItem(item: Inspiration, labels: InspirationLabels): ExerciseListItem {
  const subtitle = [labels.kind[item.kind], item.source?.trim() ?? '']
    .filter((part) => part !== '')
    .join(' · ');
  const pressed = item.favourite === true;
  return {
    id: item.id,
    title: item.text.trim().replace(/\s+/g, ' '),
    ...(subtitle ? { subtitle } : {}),
    ...(item.sample ? { chips: [{ label: labels.example }] } : {}),
    done: !item.sample && isItemComplete(item),
    toggle: {
      pressed,
      icon: 'star_border',
      pressedIcon: 'star',
      label: labels.favourite,
      hint: pressed ? labels.unfavourite : labels.favourite,
    },
  };
}

// ---- Edits ----

/** A form edit as stored fields: tags normalised, an unset star or an emptied source dropped (an
 * absent field, never `false` or `''`), so the draft path, which merges fields as they come,
 * stores the same shape as a saved-record edit (playbook §6's first pitfall). */
export function editFields(edit: Partial<InspirationFields>): Partial<InspirationFields> {
  const fields: Record<string, unknown> = { ...edit };
  if ('tags' in edit && edit.tags) {
    fields['tags'] = normaliseTags(edit.tags);
  }
  if ('favourite' in edit && !edit.favourite) {
    fields['favourite'] = undefined;
  }
  if ('source' in edit && !hasText(edit.source)) {
    fields['source'] = undefined;
  }
  return fields as Partial<InspirationFields>;
}

const sameValue = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((value, index) => value === b[index])
    : a === b;

/** `record` without the keys whose value is `undefined` (an optional field cleared). */
function withoutUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

/** Merges `fields` into the live item `id`, making a sample the user's own (issue #232). The same
 * array when `id` isn't a live item or nothing changes. */
export function editInspiration(
  list: readonly Inspiration[],
  id: string,
  fields: Partial<InspirationFields>,
): readonly Inspiration[] {
  const index = list.findIndex((item) => item.id === id && isLive(item));
  if (index < 0) {
    return list;
  }
  const item = list[index];
  const changed = (Object.keys(fields) as (keyof InspirationFields)[]).some(
    (key) => !sameValue(item[key], fields[key]),
  );
  if (!changed) {
    return list;
  }
  const next = [...list];
  next[index] = withoutSample(withoutUndefined({ ...item, ...fields }));
  return next;
}

/** Tombstones `id` (never removed); the same array when it isn't live. */
export function removeInspiration(
  list: readonly Inspiration[],
  id: string,
  now: Date,
): readonly Inspiration[] {
  return list.some((item) => item.id === id && isLive(item))
    ? list.map((item) => (item.id === id ? softDelete(item, now) : item))
    : list;
}

/** Undoes `removeInspiration()`; the same array when `id` isn't deleted. */
export function restoreInspiration(
  list: readonly Inspiration[],
  id: string,
  now: Date,
): readonly Inspiration[] {
  return list.some((item) => item.id === id && !isLive(item))
    ? list.map((item) =>
        item.id === id ? touch(withoutUndefined({ ...item, deletedAt: undefined }), now) : item,
      )
    : list;
}

// ---- Mission input and samples ----

/** What Your mission offers from the collection (issue #61's contract): counted items with a line,
 * favourites first, list order otherwise. Samples are left out: they aren't the user's words. */
export function forMission(list: readonly Inspiration[]): readonly MissionInputItem[] {
  const withText = countedItems(list).filter((item) => hasText(item.text));
  const ordered = [
    ...withText.filter((item) => item.favourite),
    ...withText.filter((item) => !item.favourite),
  ];
  return ordered.map((item) => ({
    id: item.id,
    text: item.text.trim(),
    ...(hasText(item.source) ? { detail: item.source!.trim() } : {}),
    tags: itemTags(item),
    favourite: item.favourite === true,
  }));
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** A guide example's `sample` payload as a new item's fields, or `null` when it isn't valid (the
 * i18n JSON is an input boundary). The caller adds `sample: true`. */
export function inspirationFromExample(value: unknown): InspirationFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const text = optionalText(example['text']);
  const kind = example['kind'];
  const tags = example['tags'] ?? [];
  if (
    text === undefined ||
    !isInspirationKind(kind) ||
    !Array.isArray(tags) ||
    !tags.every((tag) => typeof tag === 'string')
  ) {
    return null;
  }
  const source = optionalText(example['source']);
  return {
    text,
    kind,
    tags: normaliseTags(tags),
    ...(source === undefined ? {} : { source }),
    ...(example['favourite'] === true ? { favourite: true } : {}),
  };
}

/** The live, untouched sample made from this example, if the user already tried it: trying it
 * again opens that one instead of adding a copy (issue #232). */
export function liveSampleOf(
  list: readonly Inspiration[],
  fields: Pick<InspirationFields, 'text' | 'kind'>,
): Inspiration | undefined {
  return list.find(
    (item) => isLive(item) && item.sample && item.text === fields.text && item.kind === fields.kind,
  );
}
