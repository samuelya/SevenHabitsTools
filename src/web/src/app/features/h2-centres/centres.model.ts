import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';
import { storeStatusFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import {
  registerMissionInput,
  storeInputFactory,
} from '../../shared/mission-inputs/mission-inputs';
import {
  CENTRE_KEYS,
  FACTOR_KEYS,
  PRINCIPLE_KEYS,
  RATINGS,
  hubStatus,
  isStarted,
  latestPrinciples,
} from './centres.logic';

export type CentreKey = (typeof CENTRE_KEYS)[number];
export type PrincipleKey = (typeof PRINCIPLE_KEYS)[number];
export type CentreRating = (typeof RATINGS)[number];
export type FactorKey = (typeof FACTOR_KEYS)[number];

export type CentreFactors = Partial<Record<FactorKey, string>>;

/** A principle: a suggested `key` or the user's own `name`, exactly one set (playbook §3). */
export interface CentrePrinciple {
  readonly key?: PrincipleKey;
  readonly name?: string;
}

/** One centres assessment (issue #60): a dated, repeatable assessment record. */
export interface CentreAssessment extends BaseRecord {
  readonly date: string;
  /** Absent = not rated yet (0 at render). The 0–3 range is logic, not `validate()`. */
  readonly ratings: Partial<Record<CentreKey, CentreRating>>;
  /** About the top centre. */
  readonly factors?: CentreFactors;
  readonly principles: readonly CentrePrinciple[];
}

export type CentreAssessmentFields = Omit<CentreAssessment, keyof BaseRecord>;

/** The model key and this exercise's `exerciseId` (playbook §1). */
export const CENTRES_MODEL_KEY = 'h2-centres';

export const CENTRES_PATH = 'habits.h2.centres';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const CENTRES_ROUTE = 'habits/h2/centres';

const isCentreKey = isOneOf(CENTRE_KEYS);
const isPrincipleKey = isOneOf(PRINCIPLE_KEYS);
const isFactorKey = isOneOf(FACTOR_KEYS);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isRatings(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    Object.entries(value).every(
      ([key, rating]) => isCentreKey(key) && (rating === undefined || typeof rating === 'number'),
    )
  );
}

function isFactors(value: unknown): boolean {
  return (
    value === undefined ||
    (isPlainObject(value) &&
      Object.entries(value).every(([key, text]) => isFactorKey(key) && isOptionalString(text)))
  );
}

function isPrinciple(value: unknown): value is CentrePrinciple {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    (value['key'] === undefined || isPrincipleKey(value['key'])) && isOptionalString(value['name'])
  );
}

const isPrincipleArray = isArrayOf(isPrinciple);

function isCentreAssessment(value: unknown): value is CentreAssessment {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['date'] === 'string' &&
    isRatings(candidate['ratings']) &&
    isFactors(candidate['factors']) &&
    isPrincipleArray(candidate['principles'])
  );
}

const isCentreAssessmentArray = isArrayOf(isCentreAssessment);

/** Registers the model, the exercise and its mission input, a no-op if already done (Vitest runs
 * with `isolate: false`). */
export function registerCentresModel(): void {
  if (getRegisteredModels().some((model) => model.key === CENTRES_MODEL_KEY)) {
    return;
  }
  registerModel<CentreAssessment[]>({
    key: CENTRES_MODEL_KEY,
    path: CENTRES_PATH,
    defaults: () => [],
    validate: isCentreAssessmentArray,
  });
  registerExercise({
    exerciseId: CENTRES_MODEL_KEY,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-centres.title',
    shortTitleKey: 'habits.exercises.h2-centres.shortTitle',
    icon: 'adjust',
    route: CENTRES_ROUTE,
    order: 30,
    isStarted: storeStartedFactory<CentreAssessment[]>(CENTRES_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<CentreAssessment[]>(CENTRES_MODEL_KEY, hubStatus),
  });
  registerMissionInput({
    sourceExerciseId: CENTRES_MODEL_KEY,
    kind: 'principles',
    read: storeInputFactory<CentreAssessment[]>(CENTRES_MODEL_KEY, latestPrinciples),
  });
}

registerCentresModel();
