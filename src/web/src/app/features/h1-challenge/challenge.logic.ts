import { isLive, touch } from '../../core/data/record';
import { addDays, resolvedBetween } from '../../shared/commitments/commitments.logic';
import type { Commitment } from '../../shared/commitments/commitments.model';
import { isValidIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
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
import type { Challenge, ChallengeFields, CheckIn, CheckInAnswers } from './challenge.model';

/**
 * Every rule of the 30-day test (issue #56) as pure functions. Dates are local `YYYY-MM-DD`
 * strings; "today" is always passed in (the page's `todaySignal()`, from `CLOCK`), never read here.
 */

/** How long a test runs. */
export const CHALLENGE_DAYS = 30;
/** The day the halfway note appears. */
export const MID_DAY = 15;

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). Counted on UTC dates,
 * so a daylight-saving change between them never makes a day 23 or 25 hours long. */
export function daysBetween(from: string, to: string): number {
  const utc = (date: string): number => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Day 30's date. */
export function lastDay(c: Pick<Challenge, 'startDate'>): string {
  return addDays(c.startDate, CHALLENGE_DAYS - 1);
}

/** Days since the start date + 1: 1–30 while the window runs, 31+ once it has passed. Never below
 * 1 (a start date after today, only possible through an import). */
export function dayNumber(c: Pick<Challenge, 'startDate'>, today: string): number {
  return Math.max(1, daysBetween(c.startDate, today) + 1);
}

/** The header's "Day N of 30": the day number, held at 30 once the window has passed. */
export function displayDay(day: number): number {
  return Math.min(day, CHALLENGE_DAYS);
}

/** The date the test's counts are taken at: today while it runs, its end date once it has ended,
 * and never past day 30. */
export function referenceDate(c: Challenge, today: string): string {
  const end = c.status === 'active' ? today : (c.endedOn ?? today);
  const last = lastDay(c);
  return end < last ? end : last;
}

/** Where the strip's tab stop rests: today, held inside the window (day 1 before the test starts,
 * day 30 after it); day 30 for a test that has ended. */
export function anchorDate(c: Challenge, today: string): string {
  if (c.status !== 'active' || today > lastDay(c)) {
    return lastDay(c);
  }
  return today < c.startDate ? c.startDate : today;
}

export function canWriteMid(c: Challenge, today: string): boolean {
  return dayNumber(c, today) >= MID_DAY;
}

export function canFinish(c: Challenge, today: string): boolean {
  return dayNumber(c, today) >= CHALLENGE_DAYS;
}

/** The running test, if any (only one runs at a time). */
export function activeChallenge(list: readonly Challenge[]): Challenge | null {
  return list.find((c) => isLive(c) && c.status === 'active') ?? null;
}

/** Completed and stopped tests, latest start first. */
export function pastChallenges(list: readonly Challenge[]): Challenge[] {
  return list
    .filter((c) => isLive(c) && c.status !== 'active')
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function checkinOn(c: Challenge, date: string): CheckIn | undefined {
  return c.checkins.find((checkin) => checkin.date === date);
}

/** Answered, not skipped. */
export function isCheckedIn(checkin: CheckIn | undefined): boolean {
  return checkin !== undefined && !checkin.skipped && checkin.answers !== undefined;
}

export type DayState = 'checkedIn' | 'skipped' | 'missed' | 'today' | 'future';

/** One cell of the day strip. `isToday` stays true on a checked-in today, whose `state` is
 * `checkedIn`. */
export interface DayCell {
  readonly day: number;
  readonly date: string;
  readonly state: DayState;
  readonly isToday: boolean;
}

/** The 30 cells as of `today`. An ended test has no today. A completed test is read as of the
 * day after its window, so every unrecorded day reads as missed. A stopped test is read as of its
 * stop date: an unrecorded day up to it is missed, the days after it never came (coming up). */
export function dayStates(c: Challenge, today: string): DayCell[] {
  const active = c.status === 'active';
  const ended = c.status === 'stopped' && c.endedOn ? c.endedOn : lastDay(c);
  const asOf = active ? today : addDays(ended, 1);
  return Array.from({ length: CHALLENGE_DAYS }, (_, index) => {
    const date = addDays(c.startDate, index);
    const checkin = checkinOn(c, date);
    const isToday = active && date === asOf;
    let state: DayState;
    if (checkin?.skipped) {
      state = 'skipped';
    } else if (isCheckedIn(checkin)) {
      state = 'checkedIn';
    } else if (isToday) {
      state = 'today';
    } else {
      state = date < asOf ? 'missed' : 'future';
    }
    return { day: index + 1, date, state, isToday };
  });
}

/** Consecutive checked-in days ending on `today` or the day before (today may still be to come);
 * a skipped or missed day ends it. Counted up to day 30 at the latest (`referenceDate()`). */
export function streak(c: Challenge, today: string): number {
  const asOf = referenceDate(c, today);
  let date = isCheckedIn(checkinOn(c, asOf)) ? asOf : addDays(asOf, -1);
  let count = 0;
  while (date >= c.startDate && isCheckedIn(checkinOn(c, date))) {
    count += 1;
    date = addDays(date, -1);
  }
  return count;
}

/** Checked-in days inside the 30-day window. */
export function checkedInCount(c: Challenge): number {
  const last = lastDay(c);
  return c.checkins.filter((ci) => ci.date >= c.startDate && ci.date <= last && isCheckedIn(ci))
    .length;
}

/** Today's check-in can be saved: the test runs, today is inside the window and not skipped. */
export function canCheckIn(c: Challenge, today: string): boolean {
  return (
    c.status === 'active' &&
    today >= c.startDate &&
    today <= lastDay(c) &&
    !checkinOn(c, today)?.skipped
  );
}

/** `date` can be marked skipped: a past day of a running test with nothing recorded. */
export function canSkip(c: Challenge, date: string, today: string): boolean {
  return (
    c.status === 'active' &&
    isValidIsoDate(date) &&
    date >= c.startDate &&
    date < today &&
    date <= lastDay(c) &&
    !checkinOn(c, date)
  );
}

const optionalText = (value: string | undefined): string | undefined =>
  value !== undefined && value.trim() !== '' ? value : undefined;

/** `checkin` as stored: no key with an `undefined` value. */
function tidyCheckIn(checkin: CheckIn): CheckIn {
  return Object.fromEntries(
    Object.entries(checkin).filter(([, value]) => value !== undefined),
  ) as unknown as CheckIn;
}

function withCheckInFor(c: Challenge, checkin: CheckIn, now: Date): Challenge {
  const others = c.checkins.filter((ci) => ci.date !== checkin.date);
  const checkins = [...others, tidyCheckIn(checkin)].sort((a, b) => a.date.localeCompare(b.date));
  return touch({ ...c, checkins }, now);
}

/** Records (or replaces) today's check-in; `null` when `canCheckIn()` refuses. */
export function withCheckIn(
  c: Challenge,
  today: string,
  answers: CheckInAnswers,
  note: string | undefined,
  now: Date,
): Challenge | null {
  if (!canCheckIn(c, today)) {
    return null;
  }
  return withCheckInFor(c, { date: today, answers: { ...answers }, note: optionalText(note) }, now);
}

/** Marks the missed `date` skipped; `null` when `canSkip()` refuses. */
export function withSkip(
  c: Challenge,
  date: string,
  reason: string | undefined,
  today: string,
  now: Date,
): Challenge | null {
  if (!canSkip(c, date, today)) {
    return null;
  }
  return withCheckInFor(c, { date, skipped: true, skipReason: optionalText(reason) }, now);
}

export type ChallengeNote = 'midNote' | 'finalNote';

/** Sets the halfway or final note of a running test; an empty one is removed. */
export function withNote(c: Challenge, field: ChallengeNote, text: string, now: Date): Challenge {
  const next: Record<string, unknown> = { ...c, [field]: optionalText(text) };
  if (next[field] === undefined) {
    delete next[field];
  }
  return touch(next as unknown as Challenge, now);
}

export function hasFinalNote(c: Challenge): boolean {
  return optionalText(c.finalNote) !== undefined;
}

/** "Finish test": Completed from day 30, once the final note is written; `null` otherwise. */
export function finishChallenge(c: Challenge, today: string, now: Date): Challenge | null {
  if (c.status !== 'active' || !canFinish(c, today) || !hasFinalNote(c)) {
    return null;
  }
  return touch<Challenge>({ ...c, status: 'completed', endedOn: today }, now);
}

/** "Stop test": Stopped on `today`; `null` for a test that has already ended. */
export function stopChallenge(c: Challenge, today: string, now: Date): Challenge | null {
  return c.status === 'active'
    ? touch<Challenge>({ ...c, status: 'stopped', endedOn: today }, now)
    : null;
}

/** A new running test's fields. The start date is cleaned first (a date input can hand over `''`
 * or a half-typed value): anything that isn't a real date, or is after today, starts today. */
export function newChallengeFields(
  startDate: string,
  focus: string | undefined,
  today: string,
): ChallengeFields {
  const start = isValidIsoDate(startDate) && startDate <= today ? startDate : today;
  const text = optionalText(focus);
  return { startDate: start, status: 'active', checkins: [], ...(text ? { focus: text } : {}) };
}

/** Started once any live test exists. */
export function isStarted(list: readonly Challenge[]): boolean {
  return list.some(isLive);
}

/** The hub's status text (issue #56): "Day 12, 5-day streak" while a test runs ("Day 12" with no
 * streak: never a zero counter), "1 test completed" with none running, else `null`. */
export function hubStatus(list: readonly Challenge[], today: string): ExerciseHubStatus | null {
  const active = activeChallenge(list);
  if (active) {
    const day = displayDay(dayNumber(active, today));
    const count = streak(active, today);
    return count > 0
      ? { key: 'habits.exercises.h1-challenge.dayStreak', count, params: { day } }
      : { key: 'habits.exercises.h1-challenge.dayNumber', count: day };
  }
  const completed = list.filter((c) => isLive(c) && c.status === 'completed').length;
  return completed > 0
    ? { key: 'habits.exercises.h1-challenge.completedCount', count: completed }
    : null;
}

/** Kept and resolved promises during a test (`resolvedBetween()`, #57): `null` with none resolved,
 * so the line is omitted rather than "Kept 0 of 0". */
export interface PromiseTally {
  readonly kept: number;
  readonly count: number;
}

export function promiseTally(
  c: Challenge,
  commitments: readonly Commitment[],
  today: string,
): PromiseTally | null {
  const resolved = resolvedBetween(commitments, c.startDate, referenceDate(c, today)).filter(
    (p) => p.status === 'kept' || p.status === 'broken',
  );
  const kept = resolved.filter((p) => p.status === 'kept').length;
  return resolved.length === 0 ? null : { kept, count: resolved.length };
}

/** A test's summary: each count is shown only once it is at least 1. */
export interface ChallengeSummary {
  readonly checkedIn: number;
  readonly streak: number;
  readonly promises: PromiseTally | null;
}

/** Whether the summary has anything to show. */
export function hasCounts(summary: ChallengeSummary): boolean {
  return summary.checkedIn > 0 || summary.streak > 0 || summary.promises !== null;
}

export function summarize(
  c: Challenge,
  commitments: readonly Commitment[],
  today: string,
): ChallengeSummary {
  return {
    checkedIn: checkedInCount(c),
    streak: streak(c, today),
    promises: promiseTally(c, commitments, today),
  };
}

/** The three gate items (issue #56), in the order the user does them. */
export const CHECKLIST_KEYS = ['start', 'day30', 'final'] as const;
export type ChallengeChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** `final` is met by a finished test: finishing needs the final note (`finishChallenge()`), and a
 * written note on a test that isn't finished yet would tick every row while "Mark done" stays off. */
function challengeMet(c: Challenge, today: string): ChecklistMet<ChallengeChecklistKey> {
  const completed = c.status === 'completed';
  return {
    start: true,
    day30: completed || canFinish(c, today),
    final: completed,
  };
}

/** A stopped test never satisfies the gate, so only running and completed tests are candidates. */
function checklistMet(
  list: readonly Challenge[],
  today: string,
): ChecklistMet<ChallengeChecklistKey> {
  const candidates = list.filter((c) => isLive(c) && c.status !== 'stopped');
  return closestMet(candidates, CHECKLIST_KEYS, (c) => challengeMet(c, today));
}

/** "Mark done" is enabled once a live test is Completed: exactly when every checklist row is met,
 * since only a completed test meets `final`. */
export function isComplete(list: readonly Challenge[]): boolean {
  return list.some((c) => isLive(c) && c.status === 'completed');
}

export function doneChecklist(
  list: readonly Challenge[],
  today: string,
  labels: ChecklistLabels<ChallengeChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(list, today), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<ChallengeChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<ChallengeChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}
