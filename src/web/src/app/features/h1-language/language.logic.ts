import { isLive, newRecord, softDelete, touch } from '../../core/data/record';
import { addDays } from '../../shared/commitments/commitments.logic';
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
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import type { ExerciseListItem } from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import { isCounted, withoutSample } from '../../shared/exercise-kit/sample-record.logic';
import {
  LanguageLog,
  ListeningDay,
  PHRASE_KINDS,
  Phrase,
  PhraseFields,
  PhraseKind,
  isPhraseKind,
} from './language.model';

const hasText = (text: string | undefined): boolean => Boolean(text?.trim());

/** How long a listening day runs unless ended earlier (issue #54). */
export const LISTENING_DAY_MS = 24 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

/** When `day` stops by itself: `startedAt + 24 h`, in ms; `NaN` for an unreadable `startedAt`. */
function scheduledEnd(day: Pick<ListeningDay, 'startedAt'>): number {
  return Date.parse(day.startedAt) + LISTENING_DAY_MS;
}

/** Issue #54's rule: live, not ended by the user, and `now` before `startedAt + 24 h`. Derived,
 * never stored: a page that was closed, hidden or asleep at the 24-hour mark reads the right state
 * from the clock alone. An unreadable `startedAt` is never running. */
export function isRunning(day: ListeningDay, now: Date): boolean {
  return isLive(day) && day.endedAt === undefined && now.getTime() < scheduledEnd(day);
}

/** `endedAt ?? min(now, startedAt + 24 h)` (issue #54). */
export function effectiveEnd(day: ListeningDay, now: Date): Date {
  if (day.endedAt !== undefined) {
    return new Date(day.endedAt);
  }
  return new Date(Math.min(now.getTime(), scheduledEnd(day)));
}

/** Whether `day` has ended: live and no longer running. */
export function hasEnded(day: ListeningDay, now: Date): boolean {
  return isLive(day) && !isRunning(day, now);
}

/** The live days, most recently started first. */
function liveDaysNewestFirst(days: readonly ListeningDay[]): ListeningDay[] {
  return days.filter(isLive).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** The one running day, or `null`. Only one runs at a time; were two ever stored (two devices),
 * the latest wins. */
export function runningDay(days: readonly ListeningDay[], now: Date): ListeningDay | null {
  return liveDaysNewestFirst(days).find((day) => isRunning(day, now)) ?? null;
}

/** The most recently started live day, running or not; `null` with none. */
export function latestDay(days: readonly ListeningDay[]): ListeningDay | null {
  return liveDaysNewestFirst(days)[0] ?? null;
}

/** Whole hours left in a running day, rounded up: 24 right after the start, 1 in its last hour.
 * Never above 24, even for a `now` read a moment before `startedAt`. */
export function hoursLeft(day: ListeningDay, now: Date): number {
  const hours = Math.ceil((scheduledEnd(day) - now.getTime()) / HOUR_MS);
  return Math.min(LISTENING_DAY_MS / HOUR_MS, Math.max(0, hours));
}

/** What the listening-day area shows (issue #54): "Start listening" before any day, the banner
 * with "End day" while one runs, and the last day's summary with "New day" once it has ended. */
export type DayState =
  | { readonly kind: 'none' }
  | { readonly kind: 'running'; readonly day: ListeningDay; readonly hoursLeft: number }
  | { readonly kind: 'ended'; readonly day: ListeningDay };

export function dayState(days: readonly ListeningDay[], now: Date): DayState {
  const running = runningDay(days, now);
  if (running !== null) {
    return { kind: 'running', day: running, hoursLeft: hoursLeft(running, now) };
  }
  const latest = latestDay(days);
  return latest === null ? { kind: 'none' } : { kind: 'ended', day: latest };
}

/** A new listening day starting `now`, appended; unchanged while one is already running (only one
 * runs at a time). */
export function startDay(log: LanguageLog, now: Date): LanguageLog {
  if (runningDay(log.listeningDays, now) !== null) {
    return log;
  }
  const day: ListeningDay = newRecord({ startedAt: now.toISOString() }, now);
  return { ...log, listeningDays: [...log.listeningDays, day] };
}

/** "End day": sets `endedAt` on the running day `id`; any other day is left alone. */
export function endDay(log: LanguageLog, id: string, now: Date): LanguageLog {
  return {
    ...log,
    listeningDays: log.listeningDays.map((day) =>
      day.id === id && isRunning(day, now)
        ? touch({ ...day, endedAt: now.toISOString() }, now)
        : day,
    ),
  };
}

/** The ended day's summary card (issue #54): of the counted phrases logged in it, how many gave
 * the choice away, how many owned it, and how many of the first were rewritten. */
export interface DaySummary {
  readonly reactive: number;
  readonly proactive: number;
  readonly rewritten: number;
}

export function daySummary(phrases: readonly Phrase[], dayId: string): DaySummary {
  const inDay = countedPhrases(phrases).filter((phrase) => phrase.listeningDayId === dayId);
  const reactive = inDay.filter((phrase) => phrase.kind === 'reactive');
  return {
    reactive: reactive.length,
    proactive: inDay.length - reactive.length,
    rewritten: reactive.filter((phrase) => hasText(phrase.reframe)).length,
  };
}

/** Issue #54's rule: the phrase is written, and either owns the choice or has a rewrite. */
export function isItemComplete(phrase: Pick<Phrase, 'text' | 'kind' | 'reframe'>): boolean {
  return hasText(phrase.text) && (phrase.kind === 'proactive' || hasText(phrase.reframe));
}

/** Live phrases only (architecture issue #1 §6: tombstoned records are never shown). */
export function livePhrases(phrases: readonly Phrase[]): Phrase[] {
  return phrases.filter(isLive);
}

/** The live phrases that count toward progress, summaries and the done gate (`isCounted()`). */
export function countedPhrases(phrases: readonly Phrase[]): Phrase[] {
  return phrases.filter(isCounted);
}

/** Started once any counted phrase or any listening day exists (issues #54, #216, #232). */
export function isStarted(log: LanguageLog): boolean {
  return log.phrases.some(isCounted) || log.listeningDays.some(isLive);
}

/** The hub's in-progress text (issue #219): "3 phrases"; `null` with none. */
export function hubStatus(log: LanguageLog): ExerciseHubStatus | null {
  const count = countedPhrases(log.phrases).length;
  return count > 0 ? { key: 'habits.exercises.h1-language.phraseCount', count } : null;
}

/** The three gate items (issue #54), in the order the exercise asks for them. */
export const CHECKLIST_KEYS = ['day', 'phrase', 'rewrite'] as const;
export type LanguageChecklistKey = (typeof CHECKLIST_KEYS)[number];

const PHRASE_KEYS = ['phrase', 'rewrite'] as const;

function phraseMet(phrase: Phrase): ChecklistMet<(typeof PHRASE_KEYS)[number]> {
  return {
    phrase: hasText(phrase.text),
    rewrite: hasText(phrase.text) && hasText(phrase.reframe),
  };
}

/** A day has ended, and the counted reactive phrase closest to done (`closestMet()`) is written
 * and rewritten. */
function checklistMet(log: LanguageLog, now: Date): ChecklistMet<LanguageChecklistKey> {
  const reactive = countedPhrases(log.phrases).filter((phrase) => phrase.kind === 'reactive');
  return {
    day: log.listeningDays.some((day) => hasEnded(day, now)),
    ...closestMet(reactive, PHRASE_KEYS, phraseMet),
  };
}

/** Whether `DoneToggle` is enabled (issue #54): a listening day has ended and a counted reactive
 * phrase has a rewrite. */
export function isComplete(log: LanguageLog, now: Date): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(log, now));
}

export function doneChecklist(
  log: LanguageLog,
  now: Date,
  labels: ChecklistLabels<LanguageChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(log, now), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<LanguageChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<LanguageChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** One row of the "Last 7 days" table: a local date and its counted phrases by kind. */
export interface DayCount {
  /** `YYYY-MM-DD`, local. */
  readonly date: string;
  readonly reactive: number;
  readonly proactive: number;
}

/** The local date a phrase was added on. */
function phraseDate(phrase: Phrase): string {
  return localDateString(new Date(phrase.createdAt));
}

/** Counted phrases per local day by kind, for the `days` days ending `today`, oldest first; a day
 * without phrases is a row of zeros. */
export function perDay(phrases: readonly Phrase[], today: string, days = 7): DayCount[] {
  const counted = countedPhrases(phrases);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - days + 1);
    const onDate = counted.filter((phrase) => phraseDate(phrase) === date);
    const reactive = onDate.filter((phrase) => phrase.kind === 'reactive').length;
    return { date, reactive, proactive: onDate.length - reactive };
  });
}

/** Consecutive local days with at least one counted phrase, ending `today` or, when today has none
 * yet, yesterday (issue #54); 0 otherwise. */
export function streak(phrases: readonly Phrase[], today: string): number {
  const dates = new Set(countedPhrases(phrases).map(phraseDate));
  let date = dates.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (dates.has(date)) {
    count += 1;
    date = addDays(date, -1);
  }
  return count;
}

/** Already-translated labels for the row subtitle and the sample chip, built by the page. */
export interface PhraseLabels {
  readonly kind: Record<PhraseKind, string>;
  readonly example?: string;
  /** The locale's short date and time for an ISO timestamp. */
  readonly formatTime: (iso: string) => string;
}

/** Builds the kind labels from `translateSignal` output; `translateSignal` with an array key
 * starts at `['']`, so a missing index falls back to `''` (playbook §6). */
export function kindLabelsFrom(
  labels: readonly (string | undefined)[],
): Record<PhraseKind, string> {
  return Object.fromEntries(
    PHRASE_KINDS.map((kind, index) => [kind, labels[index] ?? '']),
  ) as Record<PhraseKind, string>;
}

/** The first non-blank line of `text`, trimmed; `''` when there is none. */
function firstLine(text: string | undefined): string {
  return (
    (text ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}

/** Maps a phrase to its `ExerciseList` row (issue #54): what was said as the title (else `''`,
 * shown as "Untitled"), the kind and the time it was added as the subtitle. A sample leads with an
 * "Example" chip and never shows the done check. */
export function toListItem(phrase: Phrase, labels: PhraseLabels): ExerciseListItem {
  const subtitle = [labels.kind[phrase.kind], labels.formatTime(phrase.createdAt)]
    .filter((label) => label !== '')
    .join(' · ');
  return {
    id: phrase.id,
    title:
      [phrase.text, phrase.reframe, phrase.context].map(firstLine).find((text) => text !== '') ??
      '',
    subtitle,
    ...(phrase.sample ? { chips: [{ label: labels.example ?? '' }] } : {}),
    done: !phrase.sample && isItemComplete(phrase),
  };
}

/** Draft before record (issue #54): a new phrase becomes a record on the first typed character in
 * "What you said". Picking the kind, or typing the rewrite or where first, keeps it a draft. */
export function isDraftWorthSaving(draft: Pick<PhraseFields, 'text'>): boolean {
  return hasText(draft.text);
}

/** `fields` as an edit may apply them on either path, the unsaved draft's raw merge
 * (`record-draft.ts`) or `editPhrase`: an emptied optional field (`reframe`, `context`) becomes
 * `undefined`, which clears it, so an empty string never reaches storage. */
export function phraseEdit(fields: Partial<PhraseFields>): Partial<PhraseFields> {
  const cleared = (['reframe', 'context'] as const).filter(
    (key) => key in fields && fields[key] === '',
  );
  return cleared.length === 0
    ? fields
    : { ...fields, ...Object.fromEntries(cleared.map((key) => [key, undefined])) };
}

/** Drops `undefined` fields, so a cleared field is absent rather than stored as `undefined`. */
function withoutUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

/** Replaces the fields of the live phrase `id` with `fields`, leaving every other one alone. Any
 * edit makes a sample the user's own. */
export function editPhrase(
  phrases: readonly Phrase[],
  id: string,
  fields: Partial<PhraseFields>,
): Phrase[] {
  return phrases.map((phrase) =>
    phrase.id === id && isLive(phrase)
      ? withoutUndefined(withoutSample({ ...phrase, ...phraseEdit(fields) }))
      : phrase,
  );
}

/** A saved draft as it is stored: emptied optional fields dropped, and stamped with the running
 * listening day's id when one runs (issue #54). */
export function phraseToSave(phrase: Phrase, running: ListeningDay | null): Phrase {
  const tidy = withoutUndefined({ ...phrase, ...phraseEdit(phrase) });
  return running === null ? tidy : { ...tidy, listeningDayId: running.id };
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const SAMPLE_KEYS = ['text', 'kind', 'reframe', 'context'] as const;

/** A guide example's `sample` payload as the fields of a new phrase, or `null` when it isn't a
 * valid one (the i18n JSON is an input boundary). The caller adds `sample: true`; a sample is
 * never stamped with a listening day, since it counts toward nothing. */
export function phraseFromExample(value: unknown): PhraseFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const text = optionalText(example['text']);
  const kind = example['kind'];
  if (text === undefined || !isPhraseKind(kind)) {
    return null;
  }
  const reframe = optionalText(example['reframe']);
  const context = optionalText(example['context']);
  return {
    text,
    kind,
    ...(reframe === undefined ? {} : { reframe }),
    ...(context === undefined ? {} : { context }),
  };
}

/** The live, still-flagged sample made from these example `fields`, if the user already tried it:
 * trying again opens that one rather than adding a copy (issue #232). */
export function liveSampleOf(phrases: readonly Phrase[], fields: PhraseFields): Phrase | undefined {
  return phrases.find(
    (phrase) =>
      isLive(phrase) && phrase.sample && SAMPLE_KEYS.every((key) => phrase[key] === fields[key]),
  );
}

/** Tombstones the phrase `id` (never removed, architecture issue #1 §6). */
export function removePhrase(phrases: readonly Phrase[], id: string, now: Date): Phrase[] {
  return phrases.map((phrase) => (phrase.id === id ? softDelete(phrase, now) : phrase));
}

/** Undoes `removePhrase()` (the delete-with-undo snackbar). */
export function restorePhrase(phrases: readonly Phrase[], id: string, now: Date): Phrase[] {
  return phrases.map((phrase) =>
    phrase.id === id && !isLive(phrase) ? touch({ ...phrase, deletedAt: undefined }, now) : phrase,
  );
}
