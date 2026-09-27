import { isLive, softDelete, touch } from '../../core/data/record';
import { localDateString, parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import {
  ChecklistLabels,
  ChecklistMet,
  allMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import { ExerciseListItem } from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import { isCounted, withoutSample } from '../../shared/exercise-kit/sample-record.logic';
import {
  AFFIRMATION_CHECKS,
  Affirmation,
  AffirmationChecks,
  AffirmationFields,
  DEFAULT_PRACTICE_LENGTH,
  PRACTICE_LENGTHS,
  PracticeEntry,
  PracticeLength,
} from './affirmations.model';

// Nothing from `affirmations.model.ts` is read at module load here: the model imports this file
// to register the exercise, so its constants are only used inside functions.

const hasText = (value: string | undefined): boolean => (value ?? '').trim() !== '';

/** A new affirmation's five checks, all unticked. */
export function uncheckedChecks(): AffirmationChecks {
  return { personal: false, positive: false, present: false, visual: false, emotional: false };
}

// ---- One affirmation ----

/** How many of the five qualities are ticked ("3 of 5"). */
export function checkCount(affirmation: Pick<Affirmation, 'checks'>): number {
  return AFFIRMATION_CHECKS.filter((key) => affirmation.checks[key]).length;
}

/** The number of qualities, for "{{n}} of {{total}}". */
export function checkTotal(): number {
  return AFFIRMATION_CHECKS.length;
}

/** Complete: the sentence written and all five qualities ticked. */
export function isItemComplete(affirmation: Pick<Affirmation, 'text' | 'checks'>): boolean {
  return hasText(affirmation.text) && checkCount(affirmation) === AFFIRMATION_CHECKS.length;
}

/** Only a live, complete, active affirmation can be practised. */
export function canPractise(affirmation: Affirmation): boolean {
  return isLive(affirmation) && isItemComplete(affirmation) && affirmation.archived !== true;
}

/** The stored length if it is one of the offered ones, else the default (an imported document may
 * hold any number). */
export function practiceLength(affirmation: Pick<Affirmation, 'practiceSeconds'>): PracticeLength {
  const stored = affirmation.practiceSeconds;
  return (PRACTICE_LENGTHS as readonly number[]).includes(stored ?? NaN)
    ? (stored as PracticeLength)
    : DEFAULT_PRACTICE_LENGTH;
}

/** The latest date in the log, or `null` with none. */
export function lastPractised(affirmation: Pick<Affirmation, 'practice'>): string | null {
  return affirmation.practice.reduce<string | null>(
    (latest, entry) => (latest === null || entry.date > latest ? entry.date : latest),
    null,
  );
}

// ---- The practice timer (pure; the dialog feeds it `CLOCK` readings) ----

/** Whole seconds elapsed between two instants (ms), never negative. */
function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** Seconds left on a run of `chosen` seconds started at `startedAt`, read at `now` (both ms).
 * Computed from the clock on every read, never decremented, so a tick that fires late (a hidden
 * tab, a sleeping device) shows the right time at once. */
export function remainingSeconds(startedAt: number, now: number, chosen: number): number {
  return Math.max(0, chosen - elapsedSeconds(startedAt, now));
}

/** The seconds a run logs when it ends at `endedAt`: the time actually spent, capped at the chosen
 * length (a device that slept through the end logs the length, not the nap). */
export function secondsSpent(startedAt: number, endedAt: number, chosen: number): number {
  return Math.min(elapsedSeconds(startedAt, endedAt), chosen);
}

/** What the live region says at `remaining` seconds of `chosen`: nothing in the first half, then
 * "Halfway", then "Time's up" at zero. It only changes twice, so it is announced twice. */
export type PracticeAnnouncement = 'halfway' | 'finished' | null;

export function practiceAnnouncement(remaining: number, chosen: number): PracticeAnnouncement {
  if (remaining <= 0) {
    return 'finished';
  }
  return remaining <= chosen / 2 ? 'halfway' : null;
}

/** `seconds` as minutes and two-digit seconds, each still a number so the caller formats it in the
 * active numerals ("0:42"). */
export function clockParts(seconds: number): {
  readonly minutes: number;
  readonly seconds: number;
} {
  const whole = Math.max(0, Math.floor(seconds));
  return { minutes: Math.floor(whole / 60), seconds: whole % 60 };
}

// ---- Practice across the list ----

/** Live affirmations the user wrote (samples don't count; issue #232): the one rule for the hub,
 * the summary, the streak and the gate. */
export function countedItems(list: readonly Affirmation[]): Affirmation[] {
  return list.filter(isCounted);
}

export function isStarted(list: readonly Affirmation[]): boolean {
  return countedItems(list).some((affirmation) => hasText(affirmation.text));
}

/** Whether any counted affirmation has a practice dated `date`. */
export function practisedOn(list: readonly Affirmation[], date: string): boolean {
  return countedItems(list).some((affirmation) =>
    affirmation.practice.some((entry) => entry.date === date),
  );
}

/** Every distinct date with a practice on a counted affirmation (archived ones included: the
 * practice happened), newest first. */
export function practiceDays(list: readonly Affirmation[]): readonly string[] {
  const dates = new Set(
    countedItems(list).flatMap((affirmation) => affirmation.practice.map((entry) => entry.date)),
  );
  return [...dates].sort().reverse();
}

/** The local date one day before `date` (`YYYY-MM-DD`), across month ends and DST changes. */
function dayBefore(date: string): string {
  const day = parseIsoDate(date);
  return localDateString(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1));
}

/** Consecutive local dates with a practice, ending today or yesterday (a streak isn't broken until
 * a whole day passes without one); 0 otherwise. */
export function streak(list: readonly Affirmation[], today: string): number {
  const days = new Set(practiceDays(list));
  let day = days.has(today) ? today : dayBefore(today);
  let count = 0;
  while (days.has(day)) {
    count += 1;
    day = dayBefore(day);
  }
  return count;
}

/** "Practised today" once any counted affirmation was practised today; else "3 affirmations" over
 * the complete, active ones; `null` with neither. */
export function hubStatus(list: readonly Affirmation[], today: string): ExerciseHubStatus | null {
  if (practisedOn(list, today)) {
    return { key: 'habits.exercises.h2-affirmations.practisedToday', count: 1 };
  }
  const count = countedItems(list).filter(canPractise).length;
  return count > 0 ? { key: 'habits.exercises.h2-affirmations.affirmationCount', count } : null;
}

/** The summary card: `null` until a practice exists, so it never shows a zero. */
export interface AffirmationsSummary {
  readonly days: number;
  readonly streak: number;
}

export function summarize(list: readonly Affirmation[], today: string): AffirmationsSummary | null {
  const days = practiceDays(list).length;
  return days === 0 ? null : { days, streak: streak(list, today) };
}

// ---- Gate ----

/** Draft before record (issue #217): typed text in the affirmation or its scene. A tick alone
 * keeps it a draft. */
export function isDraftWorthSaving(draft: Pick<AffirmationFields, 'text' | 'scene'>): boolean {
  return hasText(draft.text) || hasText(draft.scene);
}

export const CHECKLIST_KEYS = ['text', 'checks', 'practice'] as const;
export type AffirmationsChecklistKey = (typeof CHECKLIST_KEYS)[number];

function itemMet(affirmation: Affirmation): ChecklistMet<AffirmationsChecklistKey> {
  return {
    text: hasText(affirmation.text),
    checks: checkCount(affirmation) === AFFIRMATION_CHECKS.length,
    practice: affirmation.practice.length > 0,
  };
}

/** One map for the button and its checklist: the counted affirmation closest to passing. */
function checklistMet(list: readonly Affirmation[]): ChecklistMet<AffirmationsChecklistKey> {
  return closestMet(countedItems(list), CHECKLIST_KEYS, itemMet);
}

/** "Mark done" is enabled once a counted affirmation is complete and practised at least once. */
export function isComplete(list: readonly Affirmation[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(list));
}

export function doneChecklist(
  list: readonly Affirmation[],
  labels: ChecklistLabels<AffirmationsChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(list), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<AffirmationsChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<AffirmationsChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

// ---- Rows ----

/** Stand-ins `translateSignal` keeps in a template, replaced with formatted values per row. */
export const N_TOKEN = '@@n@@';
export const TOTAL_TOKEN = '@@total@@';
export const DATE_TOKEN = '@@date@@';
export const ITEM_TOKEN = '@@item@@';

/** Already-translated labels and formatters, built by the page (playbook §6). */
export interface AffirmationLabels {
  readonly example: string;
  readonly practise: string;
  /** `list.practiseAria` with `ITEM_TOKEN` still in it. */
  readonly practiseAriaTemplate: string;
  readonly practisedToday: string;
  /** `list.checksText` with `N_TOKEN` and `TOTAL_TOKEN` still in it. */
  readonly checksTemplate: string;
  /** `list.lastPractisedText` with `DATE_TOKEN` still in it. */
  readonly lastPractisedTemplate: string;
  readonly formatNumber: (value: number) => string;
  readonly formatDate: (date: string) => string;
}

/** The subtitle: "3 of 5" until complete, then "Practised today" or the last practice date. */
export function rowSubtitle(
  affirmation: Affirmation,
  today: string,
  labels: AffirmationLabels,
): string {
  if (!isItemComplete(affirmation)) {
    return labels.checksTemplate
      .replace(N_TOKEN, labels.formatNumber(checkCount(affirmation)))
      .replace(TOTAL_TOKEN, labels.formatNumber(checkTotal()));
  }
  const last = lastPractised(affirmation);
  if (last === null) {
    return '';
  }
  return last === today
    ? labels.practisedToday
    : labels.lastPractisedTemplate.replace(DATE_TOKEN, labels.formatDate(last));
}

/** A row: the sentence as title, the subtitle above, "Example" on a sample, and a Practise button
 * at the inline end when it can be practised. */
export function toListItem(
  affirmation: Affirmation,
  today: string,
  labels: AffirmationLabels,
): ExerciseListItem {
  const subtitle = rowSubtitle(affirmation, today, labels);
  const title = affirmation.text.trim().replace(/\s+/g, ' ');
  return {
    id: affirmation.id,
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(affirmation.sample ? { chips: [{ label: labels.example }] } : {}),
    done: !affirmation.sample && isItemComplete(affirmation),
    ...(canPractise(affirmation)
      ? {
          action: {
            icon: 'self_improvement',
            label: labels.practiseAriaTemplate.replace(ITEM_TOKEN, title),
            hint: labels.practise,
          },
        }
      : {}),
  };
}

export function activeAffirmations(list: readonly Affirmation[]): Affirmation[] {
  return list.filter((affirmation) => isLive(affirmation) && affirmation.archived !== true);
}

export function archivedAffirmations(list: readonly Affirmation[]): Affirmation[] {
  return list.filter((affirmation) => isLive(affirmation) && affirmation.archived === true);
}

// ---- Edits ----

/** A form edit as stored fields: an emptied scene and an unset archive flag are dropped (absent,
 * never `''` or `false`), so the draft path stores the same shape as a saved-record edit
 * (playbook §6's first pitfall). */
export function editFields(edit: Partial<AffirmationFields>): Partial<AffirmationFields> {
  const fields: Record<string, unknown> = { ...edit };
  if ('scene' in edit && !hasText(edit.scene)) {
    fields['scene'] = undefined;
  }
  if ('archived' in edit && !edit.archived) {
    fields['archived'] = undefined;
  }
  return fields as Partial<AffirmationFields>;
}

const sameValue = (a: unknown, b: unknown): boolean =>
  typeof a === 'object' && a !== null && typeof b === 'object' && b !== null
    ? JSON.stringify(a) === JSON.stringify(b)
    : a === b;

function withoutUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

/** Merges `fields` into the live affirmation `id`, making a sample the user's own (issue #232).
 * The same array when `id` isn't live or nothing changes. */
export function editAffirmation(
  list: readonly Affirmation[],
  id: string,
  fields: Partial<AffirmationFields>,
): readonly Affirmation[] {
  const index = list.findIndex((item) => item.id === id && isLive(item));
  if (index < 0) {
    return list;
  }
  const item = list[index];
  const changed = (Object.keys(fields) as (keyof AffirmationFields)[]).some(
    (key) => !sameValue(item[key], fields[key]),
  );
  if (!changed) {
    return list;
  }
  const next = [...list];
  next[index] = withoutSample(withoutUndefined({ ...item, ...fields }));
  return next;
}

/** Appends `entry` to the log of `id` and remembers `length`, if it can be practised. Practising
 * a sample makes it the user's own. The same array otherwise. */
export function logPractice(
  list: readonly Affirmation[],
  id: string,
  entry: PracticeEntry,
  length: PracticeLength,
): readonly Affirmation[] {
  const index = list.findIndex((item) => item.id === id);
  if (index < 0 || !canPractise(list[index])) {
    return list;
  }
  const item = list[index];
  const next = [...list];
  next[index] = withoutSample({
    ...item,
    practiceSeconds: length,
    practice: [...item.practice, entry],
  });
  return next;
}

/** Tombstones `id` (never removed); the same array when it isn't live. */
export function removeAffirmation(
  list: readonly Affirmation[],
  id: string,
  now: Date,
): readonly Affirmation[] {
  return list.some((item) => item.id === id && isLive(item))
    ? list.map((item) => (item.id === id ? softDelete(item, now) : item))
    : list;
}

/** Undoes `removeAffirmation()`; the same array when `id` isn't deleted. */
export function restoreAffirmation(
  list: readonly Affirmation[],
  id: string,
  now: Date,
): readonly Affirmation[] {
  return list.some((item) => item.id === id && !isLive(item))
    ? list.map((item) =>
        item.id === id ? touch(withoutUndefined({ ...item, deletedAt: undefined }), now) : item,
      )
    : list;
}

// ---- Samples ----

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** A guide example's `sample` payload as a new affirmation's fields (no practice log), or `null`
 * when it isn't valid (the i18n JSON is an input boundary). The caller adds `sample: true`. */
export function affirmationFromExample(value: unknown): AffirmationFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const text = optionalText(example['text']);
  const rawChecks = example['checks'];
  if (text === undefined || typeof rawChecks !== 'object' || rawChecks === null) {
    return null;
  }
  const given = rawChecks as Record<string, unknown>;
  const checks = Object.fromEntries(
    AFFIRMATION_CHECKS.map((key) => [key, given[key] === true]),
  ) as unknown as AffirmationChecks;
  const scene = optionalText(example['scene']);
  return { text, checks, ...(scene === undefined ? {} : { scene }), practice: [] };
}

/** The live, untouched sample made from this example, if the user already tried it: trying it
 * again opens that one instead of adding a copy (issue #232). */
export function liveSampleOf(
  list: readonly Affirmation[],
  fields: Pick<AffirmationFields, 'text'>,
): Affirmation | undefined {
  return list.find((item) => isLive(item) && item.sample && item.text === fields.text);
}
