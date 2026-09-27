import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOptionalBoolean,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { isValidIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';
import { storeStatusOnDayFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from './affirmations.logic';

/** The five qualities an affirmation is checked against (issue #64), in display order. */
export const AFFIRMATION_CHECKS = [
  'personal',
  'positive',
  'present',
  'visual',
  'emotional',
] as const;
export type AffirmationCheck = (typeof AFFIRMATION_CHECKS)[number];
export type AffirmationChecks = Readonly<Record<AffirmationCheck, boolean>>;

/** The practice lengths on offer, in seconds; 60 is the default. */
export const PRACTICE_LENGTHS = [30, 60, 120] as const;
export type PracticeLength = (typeof PRACTICE_LENGTHS)[number];
export const DEFAULT_PRACTICE_LENGTH: PracticeLength = 60;

/** The fewest seconds "Done" logs (lead decision on #64): a shorter run closes without a log. */
export const MIN_PRACTICE_SECONDS = 5;

/** One practice: the local date it ended on and the seconds actually spent. A nested value object,
 * append-only (playbook §3). */
export interface PracticeEntry {
  readonly date: string;
  readonly seconds: number;
}

/** One affirmation (issue #64): the sentence, its five self-checks, an optional scene, the
 * archived flag, the last chosen practice length and the practice log. */
export interface Affirmation extends BaseRecord {
  readonly text: string;
  readonly checks: AffirmationChecks;
  readonly scene?: string;
  /** Absent means `false`. */
  readonly archived?: boolean;
  /** The last length chosen in the practice dialog. `validate()` only checks it is a number;
   * readers go through `practiceLength()`. */
  readonly practiceSeconds?: number;
  readonly practice: readonly PracticeEntry[];
  /** A copy of a guide example (issue #232), counted toward nothing until its first edit. */
  readonly sample?: boolean;
}

export type AffirmationFields = Omit<Affirmation, keyof BaseRecord>;

/** The model key and `exerciseId` (playbook §1). */
export const AFFIRMATIONS_MODEL_KEY = 'h2-affirmations';

export const AFFIRMATIONS_PATH = 'habits.h2.affirmations';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const AFFIRMATIONS_ROUTE = 'habits/h2/affirmations';

function isChecks(value: unknown): value is AffirmationChecks {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return AFFIRMATION_CHECKS.every((key) => typeof candidate[key] === 'boolean');
}

function isPracticeEntry(value: unknown): value is PracticeEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const seconds = candidate['seconds'];
  return (
    typeof candidate['date'] === 'string' &&
    isValidIsoDate(candidate['date']) &&
    Number.isInteger(seconds) &&
    (seconds as number) >= 0
  );
}

const isPracticeLog = isArrayOf(isPracticeEntry);

function isAffirmation(value: unknown): value is Affirmation {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['text'] === 'string' &&
    isChecks(candidate['checks']) &&
    isOptionalString(candidate['scene']) &&
    isOptionalBoolean(candidate['archived']) &&
    (candidate['practiceSeconds'] === undefined ||
      typeof candidate['practiceSeconds'] === 'number') &&
    isPracticeLog(candidate['practice']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isAffirmationArray = isArrayOf(isAffirmation);

/** Registers the model and the exercise, a no-op if already done (Vitest runs with
 * `isolate: false`). */
export function registerAffirmationsModel(): void {
  if (getRegisteredModels().some((model) => model.key === AFFIRMATIONS_MODEL_KEY)) {
    return;
  }
  registerModel<Affirmation[]>({
    key: AFFIRMATIONS_MODEL_KEY,
    path: AFFIRMATIONS_PATH,
    defaults: () => [],
    validate: isAffirmationArray,
  });
  registerExercise({
    exerciseId: AFFIRMATIONS_MODEL_KEY,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-affirmations.title',
    shortTitleKey: 'habits.exercises.h2-affirmations.shortTitle',
    icon: 'self_improvement',
    route: AFFIRMATIONS_ROUTE,
    order: 60,
    isStarted: storeStartedFactory<Affirmation[]>(AFFIRMATIONS_MODEL_KEY, isStarted),
    // "Practised today" depends on the date, so the hub gets `today` (issue #62's factory).
    statusFactory: storeStatusOnDayFactory<Affirmation[]>(AFFIRMATIONS_MODEL_KEY, hubStatus),
  });
}

registerAffirmationsModel();
