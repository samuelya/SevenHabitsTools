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
import { hubStatus, isStarted } from './circle.logic';

/** How much of a concern is up to the user (issue #53): Up to me / Up to others too / Out of
 * anyone's hands. Stored as a key, translated at render (architecture issue #1 §6). */
export const CONCERN_CONTROLS = ['direct', 'indirect', 'none'] as const;
export type ConcernControl = (typeof CONCERN_CONTROLS)[number];

/** Every status a concern can hold. Which ones the form offers depends on the branch
 * (`statusesFor()` in `circle.logic.ts`); `validate()` accepts all four. */
export const CONCERN_STATUSES = ['open', 'stepTaken', 'sorted', 'letGo'] as const;
export type ConcernStatus = (typeof CONCERN_STATUSES)[number];

/**
 * One thing on the user's mind (issue #53). Branch A (`direct`/`indirect`) uses `firstStep` and
 * `dueDate`; branch B (`none`) uses `letGoNote`. Switching the branch keeps the other branch's
 * text, so both may be set; `validate()` checks their type only (architecture issue #1 §6).
 */
export interface Concern extends BaseRecord {
  readonly title: string;
  readonly control: ConcernControl;
  readonly have?: string;
  readonly be?: string;
  readonly firstStep?: string;
  /** `YYYY-MM-DD`, local. */
  readonly dueDate?: string;
  readonly letGoNote?: string;
  readonly status: ConcernStatus;
  /** The promise made from this concern's first step, an id in `shared.commitments` (#57). */
  readonly commitmentId?: string;
  /** A copy of a guide example ("Try this example", issue #232): counts toward nothing until the
   * user edits it. Absent means `false`. */
  readonly sample?: boolean;
}

export type ConcernFields = Omit<Concern, keyof BaseRecord>;

/** The model key `featureStore<Concern[]>()` callers resolve, and this exercise's `exerciseId`. */
export const CIRCLE_MODEL_KEY = 'h1-circle';

/** The document path this model lives at (issue #53's data model). */
export const CIRCLE_PATH = 'habits.h1.concerns';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below). */
export const CIRCLE_ROUTE = 'habits/h1/circle';

export const isConcernControl = isOneOf(CONCERN_CONTROLS);
export const isConcernStatus = isOneOf(CONCERN_STATUSES);

/** Absent, or a real `YYYY-MM-DD` date: the due date is handed on to a promise, whose own
 * validator rejects anything else (`commitments.model.ts`). */
function isOptionalIsoDate(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && isValidIsoDate(value));
}

function isConcern(value: unknown): value is Concern {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['title'] === 'string' &&
    isConcernControl(candidate['control']) &&
    isOptionalString(candidate['have']) &&
    isOptionalString(candidate['be']) &&
    isOptionalString(candidate['firstStep']) &&
    isOptionalIsoDate(candidate['dueDate']) &&
    isOptionalString(candidate['letGoNote']) &&
    isConcernStatus(candidate['status']) &&
    isOptionalString(candidate['commitmentId']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isConcernArray = isArrayOf(isConcern);

/** Registers the `h1-circle` model and exercise, a no-op if already done (Vitest runs with
 * `isolate: false`). */
export function registerCircleModel(): void {
  if (getRegisteredModels().some((model) => model.key === CIRCLE_MODEL_KEY)) {
    return;
  }
  registerModel<Concern[]>({
    key: CIRCLE_MODEL_KEY,
    path: CIRCLE_PATH,
    defaults: () => [],
    validate: isConcernArray,
  });
  registerExercise({
    exerciseId: CIRCLE_MODEL_KEY,
    habit: 'h1',
    titleKey: 'habits.exercises.h1-circle.title',
    shortTitleKey: 'habits.exercises.h1-circle.shortTitle',
    icon: 'track_changes',
    route: CIRCLE_ROUTE,
    order: 30,
    isStarted: storeStartedFactory<Concern[]>(CIRCLE_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<Concern[]>(CIRCLE_MODEL_KEY, hubStatus),
  });
}

registerCircleModel();
