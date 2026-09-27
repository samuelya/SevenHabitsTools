import { newRecord, touch } from '../../core/data/record';
import { localDateString } from '../exercise-kit/assessment-history.logic';
import type { ExerciseHubStatus } from '../exercise-kit/exercise-registry';
import {
  Mission,
  MissionFields,
  MissionLineList,
  MissionReview,
  MissionVersion,
  ReviewInterval,
  ReviewKey,
} from './mission.model';

/** Every string list on the record: the chips of steps 1–2 and the lines of step 4. */
export type MissionListKey = 'values' | 'principles' | MissionLineList;

/** Step 4 keeps each list short (issue #61): "Ten is plenty". */
export const MAX_LINES = 10;

/** The cap per list; the chip lists have none. */
export function maxFor(list: MissionListKey): number {
  return list === 'toBe' || list === 'toDo' ? MAX_LINES : Infinity;
}

/** The one normalisation every reader of a typed line uses: trimmed, inner whitespace collapsed. */
export function normaliseLine(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Two lines are the same when their normalised text matches case-insensitively. */
export function sameLine(a: string, b: string): boolean {
  return normaliseLine(a).toLocaleLowerCase() === normaliseLine(b).toLocaleLowerCase();
}

export function hasLine(list: readonly string[], text: string): boolean {
  return list.some((line) => sameLine(line, text));
}

/** What adding a line did: `added`, or why the list is unchanged. The caller keeps the typed text
 * unless the line is now in the list (`added`, `duplicate`). */
export type AddOutcome = 'added' | 'duplicate' | 'empty' | 'full' | 'refused';

/** `list` with `text` appended (normalised), or the reason it isn't. */
export function withLine(
  list: readonly string[],
  text: string,
  max: number,
): { readonly list: readonly string[]; readonly outcome: Exclude<AddOutcome, 'refused'> } {
  const line = normaliseLine(text);
  if (line === '') {
    return { list, outcome: 'empty' };
  }
  if (hasLine(list, line)) {
    return { list, outcome: 'duplicate' };
  }
  if (list.length >= max) {
    return { list, outcome: 'full' };
  }
  return { list: [...list, line], outcome: 'added' };
}

/** `list` without the line at `index`; the same list when there is none. */
export function withoutLine(list: readonly string[], index: number): readonly string[] {
  return index >= 0 && index < list.length ? list.filter((_, i) => i !== index) : list;
}

export function blankMissionFields(): MissionFields {
  return {
    values: [],
    principles: [],
    roleLines: [],
    toBe: [],
    toDo: [],
    draft: '',
    checklist: {},
    versions: [],
  };
}

/** Whether an edit carries anything the user wrote or chose: the record is created on the first
 * one (a chip added, a line typed, any checklist answer, "No" included), never on an empty
 * keystroke. */
export function isDraftWorthSaving(fields: Partial<MissionFields>): boolean {
  return Object.values(fields).some((value) => {
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some((answer) => typeof answer === 'boolean');
    }
    return false;
  });
}

/**
 * `mission` with `fields` applied. A no-op edit (every field already equal) returns `mission`
 * itself, and so does an edit that isn't worth creating the record for, while it doesn't exist.
 */
export function editMission(
  mission: Mission | null,
  fields: Partial<MissionFields>,
  now: Date,
): Mission | null {
  if (mission === null) {
    return isDraftWorthSaving(fields)
      ? newRecord({ ...blankMissionFields(), ...fields }, now)
      : null;
  }
  const changed = (Object.keys(fields) as (keyof MissionFields)[]).some(
    (key) => !Object.is(fields[key], mission[key]),
  );
  return changed ? touch({ ...mission, ...fields }, now) : mission;
}

/** `mission` with `roleId`'s line set; an emptied line is dropped. Unchanged → same reference. */
export function roleLinesWith(
  lines: Mission['roleLines'],
  roleId: string,
  text: string,
): Mission['roleLines'] {
  const existing = lines.find((line) => line.roleId === roleId);
  if (text.trim() === '') {
    return existing ? lines.filter((line) => line.roleId !== roleId) : lines;
  }
  if (!existing) {
    return [...lines, { roleId, text }];
  }
  return existing.text === text
    ? lines
    : lines.map((line) => (line.roleId === roleId ? { roleId, text } : line));
}

/** `checklist` with `key` answered; the same object when the answer is unchanged. */
export function checklistWith(
  checklist: Mission['checklist'],
  key: ReviewKey,
  value: boolean,
): Mission['checklist'] {
  return checklist[key] === value ? checklist : { ...checklist, [key]: value };
}

/** Words in `text`: whitespace-separated tokens, which holds for Arabic without a locale rule. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => token !== '').length;
}

/** `draft` with `text` added as a new paragraph at its end ("Use this"); unchanged when `text` is
 * blank. */
export function appendParagraph(draft: string, text: string): string {
  const paragraph = text.trim();
  if (paragraph === '') {
    return draft;
  }
  const body = draft.trimEnd();
  return body === '' ? paragraph : `${body}\n\n${paragraph}`;
}

function latestVersion(mission: Mission | null): MissionVersion | null {
  return mission?.versions.at(-1) ?? null;
}

/** The statement other tools read (#71, #97): the latest saved version's text, or `''`. */
export function currentStatement(mission: Mission | null): string {
  return latestVersion(mission)?.text ?? '';
}

/** "Save version" is enabled when the draft has words and differs from the latest version. */
export function canSaveVersion(mission: Mission | null): boolean {
  if (mission === null || mission.draft.trim() === '') {
    return false;
  }
  return mission.draft.trim() !== currentStatement(mission);
}

/** The longest "What changed" note (#62): one line on a 360 px version row. */
export const MAX_NOTE_LENGTH = 140;

/** A note as stored and shown: one line, at most `MAX_NOTE_LENGTH` characters; `undefined` when
 * blank. */
export function clampNote(note: string | undefined): string | undefined {
  const line = normaliseLine(note ?? '');
  return line === '' ? undefined : line.slice(0, MAX_NOTE_LENGTH).trimEnd();
}

/** `mission` with the draft appended as a new version; the same reference when it can't be. A
 * rhythm never reviewed counts from the latest version, so its stored `nextAt` moves with it. */
export function withVersion(mission: Mission, id: string, now: Date, note?: string): Mission {
  if (!canSaveVersion(mission)) {
    return mission;
  }
  const clamped = clampNote(note);
  const version: MissionVersion = {
    id,
    savedAt: now.toISOString(),
    text: mission.draft.trim(),
    ...(clamped ? { note: clamped } : {}),
  };
  const versions = [...mission.versions, version];
  const review = mission.review && syncedReview(mission.review, versions);
  return touch({ ...mission, versions, ...(review ? { review } : {}) }, now);
}

/** `mission` with version `versionId`'s text as the draft ("Restore"); the version list is
 * untouched. The same reference when there is no such version or the draft already holds it. */
export function withRestoredVersion(mission: Mission, versionId: string, now: Date): Mission {
  const version = mission.versions.find((candidate) => candidate.id === versionId);
  if (!version || mission.draft === version.text) {
    return mission;
  }
  return touch({ ...mission, draft: version.text }, now);
}

/** Restoring asks first only when it would replace unsaved words: a draft with words that matches
 * no saved version (trimmed). `versionId` isn't needed: restoring any version over a saved draft
 * loses nothing. */
export function restoreNeedsConfirm(mission: Mission | null): boolean {
  if (mission === null || mission.draft.trim() === '') {
    return false;
  }
  const draft = mission.draft.trim();
  return !mission.versions.some((version) => version.text.trim() === draft);
}

/** One row of the versions list, newest first; `n` is the 1-based version number. */
export interface VersionRow {
  readonly id: string;
  readonly n: number;
  readonly savedAt: string;
  readonly note?: string;
  readonly words: number;
  readonly text: string;
}

export function versionRows(versions: readonly MissionVersion[]): readonly VersionRow[] {
  return versions
    .map((version, index) => ({
      id: version.id,
      n: index + 1,
      savedAt: version.savedAt,
      ...(clampNote(version.note) ? { note: clampNote(version.note) } : {}),
      words: wordCount(version.text),
      text: version.text,
    }))
    .reverse();
}

const INTERVAL_MONTHS: Readonly<Record<Exclude<ReviewInterval, 'off'>, number>> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** `date` (`YYYY-MM-DD`) plus `months` calendar months, the day clamped to the target month's
 * length: Jan 31 + 1 month is Feb 28 (29 in a leap year). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return localDateString(new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay)));
}

/** The rhythm the page shows: stored, or "Off" before it is first set. */
export function reviewOf(mission: Mission | null): MissionReview {
  return mission?.review ?? { interval: 'off' };
}

/**
 * The next review date (`YYYY-MM-DD`): the last review, or the latest version's local save date
 * when never reviewed (`today` when there is neither), plus the interval. `null` when the rhythm
 * is off. Derived, never read back from the stored `nextAt`, so an imported `nextAt` that
 * disagrees can't make the page and the hub disagree.
 */
export function nextReviewDate(
  review: MissionReview,
  versions: readonly MissionVersion[],
  today: string,
): string | null {
  if (review.interval === 'off') {
    return null;
  }
  const latest = versions.at(-1);
  const base =
    review.lastReviewedAt ?? (latest ? localDateString(new Date(latest.savedAt)) : today);
  return addMonths(base, INTERVAL_MONTHS[review.interval]);
}

/** Due once a rhythm is set and its next date has come (local dates compare as strings). */
export function isReviewDue(
  review: MissionReview,
  versions: readonly MissionVersion[],
  today: string,
): boolean {
  const next = nextReviewDate(review, versions, today);
  return next !== null && next <= today;
}

/** `review` with `nextAt` recomputed (removed when off), for #98's reminders; the same reference
 * when it already agrees. Without a base date (no version, no review) it is left as it is. */
function syncedReview(review: MissionReview, versions: readonly MissionVersion[]): MissionReview {
  const base = review.lastReviewedAt ?? versions.at(-1)?.savedAt;
  if (review.interval !== 'off' && base === undefined) {
    return review;
  }
  const next = nextReviewDate(review, versions, '') ?? undefined;
  if (review.nextAt === next) {
    return review;
  }
  return {
    interval: review.interval,
    ...(review.lastReviewedAt ? { lastReviewedAt: review.lastReviewedAt } : {}),
    ...(next ? { nextAt: next } : {}),
  };
}

function withReview(mission: Mission, review: MissionReview, now: Date): Mission {
  const synced = syncedReview(review, mission.versions);
  const current = mission.review;
  return current &&
    current.interval === synced.interval &&
    current.nextAt === synced.nextAt &&
    current.lastReviewedAt === synced.lastReviewedAt
    ? mission
    : touch({ ...mission, review: synced }, now);
}

/** `mission` with the rhythm set; the same reference when unchanged, "Off" before any rhythm
 * included (nothing to store). */
export function withReviewInterval(mission: Mission, interval: ReviewInterval, now: Date): Mission {
  if (mission.review === undefined && interval === 'off') {
    return mission;
  }
  return withReview(mission, { ...reviewOf(mission), interval }, now);
}

/** `mission` reviewed on `today` ("Reviewed today"): the next date counts from it. */
export function withReviewed(mission: Mission, today: string, now: Date): Mission {
  return withReview(mission, { ...reviewOf(mission), lastReviewedAt: today }, now);
}

/** The four gate items (issue #61), in step order. */
export const CHECKLIST_KEYS = ['valueOrPrinciple', 'roleLine', 'draft', 'version'] as const;
export type MissionChecklistKey = (typeof CHECKLIST_KEYS)[number];

type ChecklistMet = Readonly<Record<MissionChecklistKey, boolean>>;

/** The one source of "met" for the stepper ticks, the gate list and the gate button. */
export function checklistMet(mission: Mission | null): ChecklistMet {
  return {
    valueOrPrinciple: (mission?.values.length ?? 0) + (mission?.principles.length ?? 0) > 0,
    roleLine: mission?.roleLines.some((line) => line.text.trim() !== '') ?? false,
    draft: wordCount(mission?.draft ?? '') > 0,
    version: (mission?.versions.length ?? 0) > 0,
  };
}

/** "Mark done" needs a saved version (lead decision Q5 on #8), which implies a draft. */
export function isComplete(mission: Mission | null): boolean {
  return checklistMet(mission).version;
}

/** Each step's tick in the stepper header, in step order (values … review). */
export function stepsDone(mission: Mission | null): readonly boolean[] {
  const met = checklistMet(mission);
  return [
    (mission?.values.length ?? 0) > 0,
    (mission?.principles.length ?? 0) > 0,
    met.roleLine,
    (mission?.toBe.length ?? 0) > 0 && (mission?.toDo.length ?? 0) > 0,
    met.draft,
    met.version,
  ];
}

export interface ChecklistItem {
  readonly label: string;
  readonly met: boolean;
}

export function doneChecklist(
  mission: Mission | null,
  labels: Readonly<Record<MissionChecklistKey, string>>,
): readonly ChecklistItem[] {
  const met = checklistMet(mission);
  return CHECKLIST_KEYS.map((key) => ({ label: labels[key], met: met[key] }));
}

/** `translateSignal`'s array output keyed back; `''` per key before the scope loads (playbook §6). */
export function checklistLabelsFrom(
  labels: readonly string[],
): Readonly<Record<MissionChecklistKey, string>> {
  return Object.fromEntries(
    CHECKLIST_KEYS.map((key, index) => [key, labels[index] ?? '']),
  ) as Readonly<Record<MissionChecklistKey, string>>;
}

export function checklistLoaded(labels: Readonly<Record<MissionChecklistKey, string>>): boolean {
  return labels[CHECKLIST_KEYS[0]] !== '';
}

/** A worksheet has started once its record exists (#216). */
export function isStarted(mission: Mission | null): boolean {
  return mission !== null;
}

/** The hub's text: "Review due" once the rhythm's date has come (`today`, local), shown even on
 * a done mission (`overridesDone`), else "Version n"
 * once saved, "Draft, n words" while drafting, else `null`. */
export function hubStatus(mission: Mission | null, today: string): ExerciseHubStatus | null {
  const versions = mission?.versions.length ?? 0;
  if (mission && versions > 0 && isReviewDue(reviewOf(mission), mission.versions, today)) {
    return { key: 'habits.exercises.h2-mission.reviewDue', count: 1, overridesDone: true };
  }
  if (versions > 0) {
    return { key: 'habits.exercises.h2-mission.versionCount', count: versions };
  }
  const words = wordCount(mission?.draft ?? '');
  return words > 0 ? { key: 'habits.exercises.h2-mission.draftWords', count: words } : null;
}
