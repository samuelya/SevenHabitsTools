import { Signal, computed, signal } from '@angular/core';
import { featureStore } from '../../core/data/feature-store';
import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { isValidIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { ExerciseHubStatus, registerExercise } from '../../shared/exercise-kit/exercise-registry';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { todaySignal } from '../../shared/exercise-kit/today';
import { hubStatus, isStarted } from './challenge.logic';

/** A test's state (issue #56): `active` while it runs, then Completed ("Finish test") or Stopped
 * ("Stop test"). Stored as a key, translated at render. */
export const CHALLENGE_STATUSES = ['active', 'completed', 'stopped'] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

/** The four evening questions (issue #56), in the order the check-in asks them. */
export const CHECKIN_QUESTIONS = ['influence', 'promise', 'response', 'noBlame'] as const;
export type CheckInQuestion = (typeof CHECKIN_QUESTIONS)[number];

export type CheckInAnswers = Readonly<Record<CheckInQuestion, boolean>>;

/** One day of a test: a nested value object keyed by `date`, one per date, edited only through its
 * test (playbook §3). A skipped day has `skipped: true` and no `answers`. */
export interface CheckIn {
  /** `YYYY-MM-DD`, local. */
  readonly date: string;
  readonly skipped?: boolean;
  readonly skipReason?: string;
  readonly answers?: CheckInAnswers;
  readonly note?: string;
}

/** One 30-day test (issue #56). */
export interface Challenge extends BaseRecord {
  /** `YYYY-MM-DD`, local: day 1. */
  readonly startDate: string;
  readonly focus?: string;
  readonly status: ChallengeStatus;
  /** `YYYY-MM-DD`, local: set on Finish or Stop. */
  readonly endedOn?: string;
  readonly checkins: readonly CheckIn[];
  readonly midNote?: string;
  readonly finalNote?: string;
}

export type ChallengeFields = Omit<Challenge, keyof BaseRecord>;

/** The model key `featureStore<Challenge[]>()` callers resolve, and this exercise's `exerciseId`. */
export const CHALLENGE_MODEL_KEY = 'h1-challenge';

/** The document path this model lives at (issue #56's data model). */
export const CHALLENGE_PATH = 'habits.h1.challenges';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below). */
export const CHALLENGE_ROUTE = 'habits/h1/challenge';

export const isChallengeStatus = isOneOf(CHALLENGE_STATUSES);

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && isValidIsoDate(value);
}

function isOptionalIsoDate(value: unknown): value is string | undefined {
  return value === undefined || isIsoDate(value);
}

function isOptionalAnswers(value: unknown): value is CheckInAnswers | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const answers = value as Record<string, unknown>;
  return CHECKIN_QUESTIONS.every((question) => typeof answers[question] === 'boolean');
}

function isCheckIn(value: unknown): value is CheckIn {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const checkin = value as Record<string, unknown>;
  return (
    isIsoDate(checkin['date']) &&
    isOptionalBoolean(checkin['skipped']) &&
    isOptionalString(checkin['skipReason']) &&
    isOptionalAnswers(checkin['answers']) &&
    isOptionalString(checkin['note'])
  );
}

const isCheckInArray = isArrayOf(isCheckIn);

function isChallenge(value: unknown): value is Challenge {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    isIsoDate(candidate['startDate']) &&
    isOptionalString(candidate['focus']) &&
    isChallengeStatus(candidate['status']) &&
    isOptionalIsoDate(candidate['endedOn']) &&
    isCheckInArray(candidate['checkins']) &&
    isOptionalString(candidate['midNote']) &&
    isOptionalString(candidate['finalNote'])
  );
}

export const isChallengeArray = isArrayOf(isChallenge);

/** The hub's status text needs today's date (day number and streak), so this is
 * `storeStatusFactory()` plus `todaySignal()`: the hub row rolls over at midnight too. */
function challengeStatusFactory(): Signal<ExerciseHubStatus | null> {
  if (!getRegisteredModels().some((model) => model.key === CHALLENGE_MODEL_KEY)) {
    return signal(null);
  }
  const store = featureStore<Challenge[]>(CHALLENGE_MODEL_KEY);
  const today = todaySignal();
  return computed(() => hubStatus(store.value(), today()));
}

/** Registers the `h1-challenge` model and exercise, a no-op if already done (Vitest runs with
 * `isolate: false`). */
export function registerChallengeModel(): void {
  if (getRegisteredModels().some((model) => model.key === CHALLENGE_MODEL_KEY)) {
    return;
  }
  registerModel<Challenge[]>({
    key: CHALLENGE_MODEL_KEY,
    path: CHALLENGE_PATH,
    defaults: () => [],
    validate: isChallengeArray,
  });
  registerExercise({
    exerciseId: CHALLENGE_MODEL_KEY,
    habit: 'h1',
    titleKey: 'habits.exercises.h1-challenge.title',
    shortTitleKey: 'habits.exercises.h1-challenge.shortTitle',
    icon: 'event_available',
    route: CHALLENGE_ROUTE,
    order: 40,
    isStarted: storeStartedFactory<Challenge[]>(CHALLENGE_MODEL_KEY, isStarted),
    statusFactory: challengeStatusFactory,
  });
}

registerChallengeModel();
