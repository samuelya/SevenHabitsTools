import { isLive, newRecord, softDelete, touch } from '../../core/data/record';
import { localDateString } from '../../shared/exercise-kit/assessment-history.logic';
import {
  allMet,
  ChecklistLabels,
  ChecklistMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { ExerciseListItem } from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import {
  TEACH_CHAPTERS,
  TeachChapter,
  TeachEntry,
  TeachEntryFields,
  TeachStatus,
} from './teach.model';

/** Every entry starts here; the chapter, and any fields the caller supplies, are applied on top. */
const DEFAULT_FIELDS: Omit<TeachEntryFields, 'chapter' | 'plannedAt'> = {
  keyIdea: '',
  status: 'planned',
};

/** `keyIdea`'s form-validated maximum length (issue #52's acceptance criteria). Business rule,
 * not part of `validate()` (architecture issue #1 §6: "checks structure, not business rules"). */
export const KEY_IDEA_MAX_LENGTH = 280;

/** Whether `keyIdea` passes the form's own validation: required, and within the character limit
 * shown by the form's counter. */
export function isKeyIdeaValid(keyIdea: string): boolean {
  const trimmed = keyIdea.trim();
  return trimmed.length > 0 && keyIdea.length <= KEY_IDEA_MAX_LENGTH;
}

/** A native `<input type="date">` emits either a full `YYYY-MM-DD` or `''` (clearing the field) —
 * never a partial value. `''` must be rejected at this boundary (CLAUDE.md "validate input at
 * system boundaries"): `plannedAt` is required (`TeachEntry.plannedAt: string`, not optional), and
 * an empty string would make `isOverdue()` compare against `'' < today`, which is permanently
 * `true` — a chapter the user only *tried* to clear would show "Overdue" forever, including after
 * export/import (`isTeachEntry`'s `typeof === 'string'` structural check lets `''` through). */
export function isValidPlannedAt(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** `plannedAt`'s default: today + 48 hours (issue #52's acceptance criteria). `localDateString`
 * (`shared/exercise-kit/assessment-history.logic.ts`), not `now.toISOString().slice(0, 10)`: the
 * latter is the UTC day, which mis-dates "today" (and, by extension, the +48h default) near a day
 * boundary in any non-UTC timezone — the exact bug #49/#50's review already caught once. */
export function defaultPlannedAt(now: Date): string {
  return localDateString(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));
}

/** The live entry for `chapter`, if the user has filled it in yet ("at most one live entry per
 * chapter", issue #52's "Implementation notes"). */
export function entryForChapter(
  entries: readonly TeachEntry[],
  chapter: TeachChapter,
): TeachEntry | undefined {
  return entries.find((entry) => entry.chapter === chapter && isLive(entry));
}

/** Creates `chapter`'s entry on first edit, or edits its existing live one — never a second live
 * entry for the same chapter. Stamps `sharedAt` from `now` the moment `status` first becomes
 * `'shared'` (issue #52's "Implementation notes"); a later edit that leaves it `'shared'` doesn't
 * restamp it. */
export function upsertEntry(
  entries: readonly TeachEntry[],
  chapter: TeachChapter,
  fields: Partial<TeachEntryFields>,
  now: Date,
): TeachEntry[] {
  const existing = entryForChapter(entries, chapter);
  if (!existing) {
    const created = newRecord<TeachEntryFields>(
      { ...DEFAULT_FIELDS, chapter, plannedAt: defaultPlannedAt(now), ...fields },
      now,
    );
    return [...entries, withSharedAt(created, undefined, now)];
  }
  const updated: TeachEntry = { ...existing, ...fields, updatedAt: now.toISOString() };
  return entries.map((entry) =>
    entry === existing ? withSharedAt(updated, existing, now) : entry,
  );
}

/** Stamps `sharedAt` the moment `status` first becomes `'shared'`; clears it again once `status`
 * moves away from `'shared'` — a stale "Shared &lt;date&gt;" hint under a since-reopened Planned or
 * Skipped toggle would be actively misleading, not just unused data (review finding on #52's PR). */
function withSharedAt(entry: TeachEntry, previous: TeachEntry | undefined, now: Date): TeachEntry {
  if (entry.status !== 'shared') {
    return entry.sharedAt === undefined ? entry : { ...entry, sharedAt: undefined };
  }
  if (previous?.status === 'shared') {
    return entry;
  }
  return { ...entry, sharedAt: localDateString(now) };
}

/** Whether `entry` is overdue: still `'planned'` past its `plannedAt` date (issue #52's
 * acceptance criteria). `localDateString`, not the UTC day — see `defaultPlannedAt`'s own doc
 * comment for why. */
export function isOverdue(entry: Pick<TeachEntry, 'status' | 'plannedAt'>, now: Date): boolean {
  return entry.status === 'planned' && entry.plannedAt < localDateString(now);
}

/** How many live entries are `'shared'` — the count shown on the Paradigms hub (issue #52's
 * acceptance criteria; `teach.model.ts`'s `statusFactory` reads this). */
export function sharedCount(entries: readonly TeachEntry[]): number {
  return entries.filter((entry) => isLive(entry) && entry.status === 'shared').length;
}

/** The two gate items (issue #215). */
export const CHECKLIST_KEYS = ['planned', 'shared'] as const;
export type TeachChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** One entry's "met" map: `planned` is met by an entry with a valid date, or by a shared one, so
 * the done rule stays #52's "one live shared entry" even for an imported entry with a blank
 * `plannedAt` (review finding on #215's PR); `shared` by its status. */
function entryMet(entry: TeachEntry): ChecklistMet<TeachChecklistKey> {
  const shared = entry.status === 'shared';
  return { planned: shared || isValidPlannedAt(entry.plannedAt), shared };
}

/** The checklist describes the live entry closest to complete (`closestMet()`). */
function checklistMet(entries: readonly TeachEntry[]): ChecklistMet<TeachChecklistKey> {
  return closestMet(entries.filter(isLive), CHECKLIST_KEYS, entryMet);
}

/** Whether `DoneToggle` should be enabled: at least one live entry is `'shared'` (issue #52's
 * "Implementation notes"), derived from the checklist (issue #215). */
export function isComplete(entries: readonly TeachEntry[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(entries));
}

/** The gate items, labelled for `DoneToggle` (see `transition.logic.ts`'s `doneChecklist()`). */
export function doneChecklist(
  entries: readonly TeachEntry[],
  labels: ChecklistLabels<TeachChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(entries), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<TeachChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

/** Gates the checklist's rendering until the scope has loaded (no blank rows on a cold visit). */
export function checklistLoaded(labels: ChecklistLabels<TeachChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** The summary card's counts (issue #52's acceptance criteria): how many of the ten chapters have
 * been shared or are overdue. `total` is always the fixed chapter count, not the number of live
 * entries — a chapter with no entry yet still counts toward it. */
export interface TeachSummary {
  readonly shared: number;
  readonly overdue: number;
  readonly total: number;
}

export function summarize(entries: readonly TeachEntry[], now: Date): TeachSummary {
  return {
    shared: sharedCount(entries),
    overdue: entries.filter((entry) => isLive(entry) && isOverdue(entry, now)).length,
    total: TEACH_CHAPTERS.length,
  };
}

/** Already-translated labels this page builds from its own Transloco scope — kept out of this
 * pure logic file so it stays testable without a translation service (playbook's "Reactive
 * labels" section). */
export interface TeachLabels {
  readonly chapter: Record<TeachChapter, string>;
  readonly status: Record<TeachStatus, string>;
  readonly overdue: string;
}

/** Builds `TeachLabels` from `translateSignal` output for each enum, plus the plain "Overdue"
 * label. `translateSignal` with an array key starts at `['']` (one placeholder, not one per key)
 * until the scope has loaded, so every index past 0 reads as `undefined` on a cold load — falling
 * back to `''` keeps the row blank instead of rendering the literal text "undefined" (playbook's
 * documented pitfall). */
export function labelsFrom(
  chapters: readonly TeachChapter[],
  chapterLabels: readonly (string | undefined)[],
  statuses: readonly TeachStatus[],
  statusLabels: readonly (string | undefined)[],
  overdueLabel: string | undefined,
): TeachLabels {
  return {
    chapter: Object.fromEntries(
      chapters.map((chapter, index) => [chapter, chapterLabels[index] ?? '']),
    ) as Record<TeachChapter, string>,
    status: Object.fromEntries(
      statuses.map((status, index) => [status, statusLabels[index] ?? '']),
    ) as Record<TeachStatus, string>,
    overdue: overdueLabel ?? '',
  };
}

/** The editor's current value for `chapter`: its live entry's own fields, or fresh defaults if it
 * has none yet (issue #52's "a record is created the first time a chapter is filled"). The editor
 * form works from this plain `TeachEntryFields` value, never `TeachEntry` directly, since a
 * not-yet-filled chapter has no record — and therefore no `id`/timestamps — to show. */
export function draftFor(
  chapter: TeachChapter,
  entry: TeachEntry | undefined,
  now: Date,
): TeachEntryFields {
  if (entry) {
    const { chapter: entryChapter, keyIdea, person, plannedAt, sharedAt, status, learned } = entry;
    return { chapter: entryChapter, keyIdea, person, plannedAt, sharedAt, status, learned };
  }
  return { chapter, keyIdea: '', plannedAt: defaultPlannedAt(now), status: 'planned' };
}

/** Maps one chapter — with or without an entry yet — to the row `ExerciseList` renders.
 * `deletable: false` for a chapter with no entry yet (issue #203): unlike every other list
 * exercise, `paradigms-teach`'s rows are the ten fixed chapters, not one-to-one with what a delete
 * removes, so a chapter with nothing filled in yet has nothing to delete — `ExerciseList` reads
 * this to skip the row's own bin button and swipe (playbook's "Deleting entries"). */
export function toListItem(
  chapter: TeachChapter,
  entry: TeachEntry | undefined,
  labels: TeachLabels,
  now: Date,
): ExerciseListItem {
  if (!entry) {
    return { id: chapter, title: labels.chapter[chapter], done: false, deletable: false };
  }
  const statusLabel = labels.status[entry.status];
  const overdue = isOverdue(entry, now);
  return {
    id: chapter,
    title: labels.chapter[chapter],
    subtitle: overdue ? `${statusLabel} · ${labels.overdue}` : statusLabel,
    done: entry.status === 'shared',
    warning: overdue,
    deletable: true,
  };
}

/** Tombstones the entry `id` (never removed, architecture issue #1 §6) — issue #203's shared
 * delete pattern. Keyed by the entry's own record id, not the chapter: `upsertEntry()` creates a
 * fresh entry the next time this chapter is filled in, the same way a deleted-then-recreated
 * script would in `paradigms-transition`. */
export function removeEntry(entries: readonly TeachEntry[], id: string, now: Date): TeachEntry[] {
  return entries.map((entry) => (entry.id === id ? softDelete(entry, now) : entry));
}

/** Undoes `removeEntry()`: clears the entry `id`'s tombstone and bumps `updatedAt` (issue #203's
 * Undo snackbar). A no-op copy if `id` is not found or was never deleted — and also if the chapter
 * already has a different live entry by the time Undo is tapped (typing into the chapter again
 * within the Undo window calls `upsertEntry()`, which creates one): restoring the old one on top
 * would leave two live entries for one chapter, breaking `upsertEntry()`'s own "never a second live
 * entry" invariant (review finding on #204's PR). */
export function restoreEntry(entries: readonly TeachEntry[], id: string, now: Date): TeachEntry[] {
  const target = entries.find((entry) => entry.id === id);
  const chapterHasLiveEntry =
    target !== undefined &&
    entries.some((entry) => entry.chapter === target.chapter && entry.id !== id && isLive(entry));
  if (!target || isLive(target) || chapterHasLiveEntry) {
    return [...entries];
  }
  return entries.map((entry) =>
    entry.id === id ? touch({ ...entry, deletedAt: undefined }, now) : entry,
  );
}
