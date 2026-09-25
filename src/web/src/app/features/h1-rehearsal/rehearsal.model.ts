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
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';
import { storeStatusFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from './rehearsal.logic';

/** How the user responded when the moment came (issue #55): As I planned / Partly / The old way.
 * Stored as a key, translated at render (architecture issue #1 §6). */
export const FOLLOW_UP_RESULTS = ['chosen', 'partly', 'reacted'] as const;
export type FollowUpResult = (typeof FOLLOW_UP_RESULTS)[number];

/** Whether the promise was kept, as the follow-up records it. */
export const FOLLOW_UP_KEPT = ['kept', 'broken'] as const;
export type FollowUpKept = (typeof FOLLOW_UP_KEPT)[number];

/** The "Afterwards" section: a nested value object, edited only through its rehearsal, with no
 * timestamps (playbook §3). `result`, `kept` and `learned` only mean something once `happened`. */
export interface RehearsalFollowUp {
  readonly happened: boolean;
  readonly result?: FollowUpResult;
  readonly kept?: FollowUpKept;
  readonly learned?: string;
}

/** One rehearsed moment (issue #55): the trigger and when it's likely, the usual reaction and its
 * cost, the chosen response as a short scene, a one-line promise, and the follow-up. */
export interface Rehearsal extends BaseRecord {
  readonly trigger: string;
  /** `YYYY-MM-DD`, local: when the moment is likely, and the promise's due date. */
  readonly expectedOn?: string;
  readonly usualReaction?: string;
  readonly cost?: string;
  readonly chosenResponse?: string;
  readonly promise?: string;
  /** The promise made from `promise`, an id in `shared.commitments` (#57). */
  readonly commitmentId?: string;
  readonly followUp?: RehearsalFollowUp;
  /** A copy of a guide example ("Try this example", issue #232): counts toward nothing until the
   * user edits it. Absent means `false`. */
  readonly sample?: boolean;
}

export type RehearsalFields = Omit<Rehearsal, keyof BaseRecord>;

/** The model key `featureStore<Rehearsal[]>()` callers resolve, and this exercise's `exerciseId`. */
export const REHEARSAL_MODEL_KEY = 'h1-rehearsal';

/** The document path this model lives at (issue #55's data model). */
export const REHEARSAL_PATH = 'habits.h1.rehearsals';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below). */
export const REHEARSAL_ROUTE = 'habits/h1/rehearsal';

export const isFollowUpResult = isOneOf(FOLLOW_UP_RESULTS);
export const isFollowUpKept = isOneOf(FOLLOW_UP_KEPT);

/** Absent, or a real `YYYY-MM-DD` date: the date is handed on to a promise, whose own validator
 * rejects anything else (`commitments.model.ts`). */
function isOptionalIsoDate(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && isValidIsoDate(value));
}

function isOptionalFollowUp(value: unknown): value is RehearsalFollowUp | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const followUp = value as Record<string, unknown>;
  return (
    typeof followUp['happened'] === 'boolean' &&
    (followUp['result'] === undefined || isFollowUpResult(followUp['result'])) &&
    (followUp['kept'] === undefined || isFollowUpKept(followUp['kept'])) &&
    isOptionalString(followUp['learned'])
  );
}

function isRehearsal(value: unknown): value is Rehearsal {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['trigger'] === 'string' &&
    isOptionalIsoDate(candidate['expectedOn']) &&
    isOptionalString(candidate['usualReaction']) &&
    isOptionalString(candidate['cost']) &&
    isOptionalString(candidate['chosenResponse']) &&
    isOptionalString(candidate['promise']) &&
    isOptionalString(candidate['commitmentId']) &&
    isOptionalFollowUp(candidate['followUp']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isRehearsalArray = isArrayOf(isRehearsal);

/** Registers the `h1-rehearsal` model and exercise, a no-op if already done (Vitest runs with
 * `isolate: false`). */
export function registerRehearsalModel(): void {
  if (getRegisteredModels().some((model) => model.key === REHEARSAL_MODEL_KEY)) {
    return;
  }
  registerModel<Rehearsal[]>({
    key: REHEARSAL_MODEL_KEY,
    path: REHEARSAL_PATH,
    defaults: () => [],
    validate: isRehearsalArray,
  });
  registerExercise({
    exerciseId: REHEARSAL_MODEL_KEY,
    habit: 'h1',
    titleKey: 'habits.exercises.h1-rehearsal.title',
    shortTitleKey: 'habits.exercises.h1-rehearsal.shortTitle',
    icon: 'theater_comedy',
    route: REHEARSAL_ROUTE,
    order: 20,
    isStarted: storeStartedFactory<Rehearsal[]>(REHEARSAL_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<Rehearsal[]>(REHEARSAL_MODEL_KEY, hubStatus),
  });
}

registerRehearsalModel();
