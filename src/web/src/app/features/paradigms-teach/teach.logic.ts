import { isLive, newRecord, softDelete, touch } from '../../core/data/record';
import {
  isValidIsoDate,
  localDateString,
} from '../../shared/exercise-kit/assessment-history.logic';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
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
import type {
  ExerciseGuideContent,
  ExerciseGuideSample,
} from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import {
  ExerciseListChip,
  ExerciseListItem,
} from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import { isCounted, withoutSample } from '../../shared/exercise-kit/sample-record.logic';
import {
  isTeachChapter,
  isTeachStatus,
  TEACH_CHAPTERS,
  TeachChapter,
  TeachEntry,
  TeachEntryFields,
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
  // The shared rule (issue #226): the pattern plus a round trip, so neither an impossible
  // `2026-13-01` nor a rolled-over `2026-02-30` gets through to `Intl.DateTimeFormat`.
  return isValidIsoDate(value);
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

/** Started once any chapter has a counted entry (issues #216, #232: a sample counts toward
 * nothing) — the hub's "started", Today's Continue and the intro card's collapse all read this. */
export function isStarted(entries: readonly TeachEntry[]): boolean {
  return entries.some(isCounted);
}

/** Creates `chapter`'s entry on first edit, or edits its existing live one — never a second live
 * entry for the same chapter. Stamps `sharedAt` from `now` the moment `status` first becomes
 * `'shared'` (issue #52's "Implementation notes"); a later edit that leaves it `'shared'` doesn't
 * restamp it. A sample (issue #232) was never really shared, so the edit that makes it the user's
 * own stamps `sharedAt` then, if its status is still `'shared'`. */
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
  // Any edit makes a sample the user's own (issue #232), whichever field changed.
  const updated: TeachEntry = withoutSample({
    ...existing,
    ...fields,
    updatedAt: now.toISOString(),
  });
  const previous = existing.sample ? undefined : existing;
  return entries.map((entry) =>
    entry === existing ? withSharedAt(updated, previous, now) : entry,
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

/** How many counted entries are `'shared'` — the count shown on the Paradigms hub (issue #52's
 * acceptance criteria; `teach.model.ts`'s `statusFactory` reads this). A sample is not counted
 * (issue #232). */
export function sharedCount(entries: readonly TeachEntry[]): number {
  return entries.filter((entry) => isCounted(entry) && entry.status === 'shared').length;
}

/** The hub's in-progress text (issues #52, #219): "2 chapters shared"; `null` before the first one
 * is shared (a started exercise then reads "In progress"). */
export function hubStatus(entries: readonly TeachEntry[]): ExerciseHubStatus | null {
  const count = sharedCount(entries);
  return count > 0 ? { key: 'habits.exercises.paradigms-teach.sharedCount', count } : null;
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

/** The checklist describes the counted entry closest to complete (`closestMet()`). */
function checklistMet(entries: readonly TeachEntry[]): ChecklistMet<TeachChecklistKey> {
  return closestMet(entries.filter(isCounted), CHECKLIST_KEYS, entryMet);
}

/** Whether `DoneToggle` should be enabled: at least one counted entry is `'shared'` (issue #52's
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
    overdue: entries.filter((entry) => isCounted(entry) && isOverdue(entry, now)).length,
    total: TEACH_CHAPTERS.length,
  };
}

/** A chapter row's status chip (issue #224), derived — never stored — from its entry's `status`
 * and `plannedAt`. */
export type ChapterStatus =
  | { readonly kind: 'notPlanned' }
  | { readonly kind: 'planned'; readonly plannedAt: string }
  | { readonly kind: 'overdue'; readonly plannedAt: string }
  | { readonly kind: 'shared' }
  | { readonly kind: 'skipped' };
export type ChapterStatusKind = ChapterStatus['kind'];
export const CHAPTER_STATUS_KINDS: readonly ChapterStatusKind[] = [
  'notPlanned',
  'planned',
  'overdue',
  'shared',
  'skipped',
];

/** `entry`'s chapter status on `today`: no entry (or a planned one without a valid date) is "Not
 * planned"; a planned one is "Planned by <date>" until that date has passed, then "Overdue"; a
 * shared or skipped one says so, whatever its date. */
export function chapterStatus(entry: TeachEntry | undefined, today: Date): ChapterStatus {
  if (!entry) {
    return { kind: 'notPlanned' };
  }
  if (entry.status === 'shared' || entry.status === 'skipped') {
    return { kind: entry.status };
  }
  if (!isValidPlannedAt(entry.plannedAt)) {
    return { kind: 'notPlanned' };
  }
  return isOverdue(entry, today)
    ? { kind: 'overdue', plannedAt: entry.plannedAt }
    : { kind: 'planned', plannedAt: entry.plannedAt };
}

/** The placeholder a status label carries for its date (`list.status.planned`: "Planned by
 * {{date}}"). The page translates the label with this as the `date` param, and `toListItem()`
 * swaps in the formatted date per row: one translated template, not one translation per row. */
export const DATE_SLOT = '%date%';

/** Already-translated labels this page builds from its own Transloco scope — kept out of this
 * pure logic file so it stays testable without a translation service (playbook's "Reactive
 * labels" section). A `status` label may contain `DATE_SLOT`. */
export interface TeachLabels {
  readonly chapter: Record<TeachChapter, string>;
  readonly status: Record<ChapterStatusKind, string>;
  /** The "Example" chip on a sample's row (issue #232). */
  readonly example?: string;
}

/** Builds `TeachLabels` from `translateSignal` output (chapters in `chapters` order, statuses in
 * `CHAPTER_STATUS_KINDS` order). `translateSignal` with an array key starts at `['']` (one
 * placeholder, not one per key) until the scope has loaded, so every index past 0 reads as
 * `undefined` on a cold load — falling back to `''` keeps the row blank instead of rendering the
 * literal text "undefined" (playbook's documented pitfall). */
export function labelsFrom(
  chapters: readonly TeachChapter[],
  chapterLabels: readonly (string | undefined)[],
  statusLabels: readonly (string | undefined)[],
  exampleLabel?: string,
): TeachLabels {
  return {
    ...(exampleLabel === undefined ? {} : { example: exampleLabel }),
    chapter: Object.fromEntries(
      chapters.map((chapter, index) => [chapter, chapterLabels[index] ?? '']),
    ) as Record<TeachChapter, string>,
    status: Object.fromEntries(
      CHAPTER_STATUS_KINDS.map((kind, index) => [kind, statusLabels[index] ?? '']),
    ) as Record<ChapterStatusKind, string>,
  };
}

/** The first non-blank line of `text`, trimmed; `''` when there is none. */
export function firstLine(text: string | undefined): string {
  return (
    (text ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}

/** Draft before record (issue #217): a chapter's first edits become its entry once any free-text
 * field (the key idea, the person, what was learned) holds non-blank text. Status or dates alone
 * keep it a draft. */
export function isDraftWorthSaving(
  fields: Partial<Pick<TeachEntryFields, 'keyIdea' | 'person' | 'learned'>>,
): boolean {
  return [fields.keyIdea, fields.person, fields.learned].some((text) => (text ?? '').trim() !== '');
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

/** Maps one chapter — with or without an entry yet — to the row `ExerciseList` renders: the
 * chapter's name, the key idea's first line (once written) and a status chip (issue #224).
 * `formatDate` turns an ISO `plannedAt` into the short, localised date the chip shows ("22 Sep").
 * `deletable: false` for a chapter with no entry yet (issue #203): the rows are the ten fixed
 * chapters, not one-to-one with what a delete removes, so a chapter with nothing filled in yet has
 * nothing to delete (playbook's "Deleting entries"). A sample (issue #232) leads with an "Example"
 * chip and never shows the done check or the overdue warning: it counts toward nothing. */
export function toListItem(
  chapter: TeachChapter,
  entry: TeachEntry | undefined,
  labels: TeachLabels,
  now: Date,
  formatDate: (isoDate: string) => string,
): ExerciseListItem {
  const status = chapterStatus(entry, now);
  const label = labels.status[status.kind];
  const chipLabel =
    'plannedAt' in status ? label.replace(DATE_SLOT, formatDate(status.plannedAt)) : label;
  const keyIdea = firstLine(entry?.keyIdea);
  const warning = !entry?.sample && status.kind === 'overdue';
  const statusChip: ExerciseListChip = { label: chipLabel, warning };
  return {
    id: chapter,
    title: labels.chapter[chapter],
    ...(keyIdea ? { subtitle: keyIdea } : {}),
    chips: entry?.sample ? [{ label: labels.example ?? '' }, statusChip] : [statusChip],
    done: !entry?.sample && status.kind === 'shared',
    warning,
    deletable: entry !== undefined,
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

/** A guide example's `sample` payload (the scope's `guide.examples[].sample`, issue #232) as the
 * chapter it is for and the fields of its new entry, or `null` when it isn't a valid one — the i18n
 * JSON is an input boundary, so its keys are checked, never trusted. `plannedAt` is left to
 * `upsertEntry()`'s usual default: the example's "This Saturday" is display text, not a date. */
export function teachSampleFromExample(
  value: unknown,
): { readonly chapter: TeachChapter; readonly fields: Partial<TeachEntryFields> } | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const { chapter, keyIdea, status } = example;
  if (
    !isTeachChapter(chapter) ||
    typeof keyIdea !== 'string' ||
    !isKeyIdeaValid(keyIdea) ||
    !isTeachStatus(status)
  ) {
    return null;
  }
  const optional = (key: 'person' | 'learned'): Partial<TeachEntryFields> => {
    const text = example[key];
    return typeof text === 'string' && text.trim() !== '' ? { [key]: text } : {};
  };
  return {
    chapter,
    fields: { keyIdea, status, ...optional('person'), ...optional('learned') },
  };
}

/** Creates `chapter`'s entry from a guide example, flagged `sample` (issue #232) — or, when the
 * chapter already has a live entry, leaves `entries` as they are: the example never overwrites
 * the user's own work, nor becomes a second entry for one chapter. A `'shared'` example gets no
 * `sharedAt`: nothing was shared yet (`upsertEntry()` stamps it when the flag clears). */
export function addSampleEntry(
  entries: readonly TeachEntry[],
  chapter: TeachChapter,
  fields: Partial<TeachEntryFields>,
  now: Date,
): TeachEntry[] {
  if (entryForChapter(entries, chapter)) {
    return [...entries];
  }
  return upsertEntry(entries, chapter, fields, now).map((entry) =>
    entry.chapter === chapter && isLive(entry)
      ? { ...entry, sharedAt: undefined, sample: true }
      : entry,
  );
}

/** The guide as "Read more" should show it (issue #232): an example whose chapter already has a
 * live entry loses its `sample`, so the dialog offers no "Try this example" that could only
 * overwrite the user's work or do nothing. `content` itself is returned when nothing changes. */
export function guideForEntries(
  content: ExerciseGuideContent | null,
  entries: readonly TeachEntry[],
): ExerciseGuideContent | null {
  if (content === null) {
    return null;
  }
  const taken = (sample: ExerciseGuideSample | undefined): boolean => {
    const chapter = sample?.['chapter'];
    return isTeachChapter(chapter) && entryForChapter(entries, chapter) !== undefined;
  };
  if (!content.examples.some((example) => example.kind === 'card' && taken(example.sample))) {
    return content;
  }
  return {
    ...content,
    examples: content.examples.map((example) =>
      example.kind === 'card' && taken(example.sample)
        ? { ...example, sample: undefined }
        : example,
    ),
  };
}
