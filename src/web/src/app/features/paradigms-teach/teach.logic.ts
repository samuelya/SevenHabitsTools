import { isLive, newRecord } from '../../core/data/record';
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

/** `YYYY-MM-DD`, the ISO date format every date in this document is stored as (architecture issue
 * #1 §6). */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `plannedAt`'s default: today + 48 hours (issue #52's acceptance criteria). */
export function defaultPlannedAt(now: Date): string {
  return isoDate(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));
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

function withSharedAt(entry: TeachEntry, previous: TeachEntry | undefined, now: Date): TeachEntry {
  if (entry.status === 'shared' && previous?.status !== 'shared') {
    return { ...entry, sharedAt: isoDate(now) };
  }
  return entry;
}

/** Whether `entry` is overdue: still `'planned'` past its `plannedAt` date (issue #52's
 * acceptance criteria). */
export function isOverdue(entry: Pick<TeachEntry, 'status' | 'plannedAt'>, now: Date): boolean {
  return entry.status === 'planned' && entry.plannedAt < isoDate(now);
}

/** How many live entries are `'shared'` — the count shown on the Paradigms hub (issue #52's
 * acceptance criteria; `teach.model.ts`'s `statusFactory` reads this). */
export function sharedCount(entries: readonly TeachEntry[]): number {
  return entries.filter((entry) => isLive(entry) && entry.status === 'shared').length;
}

/** Whether `DoneToggle` should be enabled: at least one live entry is `'shared'` (issue #52's
 * "Implementation notes"). */
export function canMarkDone(entries: readonly TeachEntry[]): boolean {
  return sharedCount(entries) > 0;
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

/** Maps one chapter — with or without an entry yet — to the row `ExerciseList` renders. */
export function toListItem(
  chapter: TeachChapter,
  entry: TeachEntry | undefined,
  labels: TeachLabels,
  now: Date,
): ExerciseListItem {
  if (!entry) {
    return { id: chapter, title: labels.chapter[chapter], done: false };
  }
  const statusLabel = labels.status[entry.status];
  const overdue = isOverdue(entry, now);
  return {
    id: chapter,
    title: labels.chapter[chapter],
    subtitle: overdue ? `${statusLabel} · ${labels.overdue}` : statusLabel,
    done: entry.status === 'shared',
    warning: overdue,
  };
}
