import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
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
import { forMission, hubStatus, isStarted } from './inspiration.logic';

/** What an item is (issue #63), stored as a key and translated at render. */
export const INSPIRATION_KINDS = ['saying', 'thought', 'idea'] as const;
export type InspirationKind = (typeof INSPIRATION_KINDS)[number];

/**
 * One item in Your collection (issue #63): a line, thought or idea in the user's own words. `tags`
 * are stored lowercased, trimmed and unique (`normaliseTag()`); `validate()` only checks they are
 * strings, and every reader normalises again, so an imported document with odd tags still loads.
 */
export interface Inspiration extends BaseRecord {
  readonly text: string;
  readonly kind: InspirationKind;
  readonly source?: string;
  readonly tags: readonly string[];
  /** Absent means `false`. */
  readonly favourite?: boolean;
  /** A copy of a guide example (issue #232), counted toward nothing until its first edit. */
  readonly sample?: boolean;
}

export type InspirationFields = Omit<Inspiration, keyof BaseRecord>;

/** The model key and `exerciseId` (playbook §1). */
export const INSPIRATION_MODEL_KEY = 'h2-inspiration';

export const INSPIRATION_PATH = 'habits.h2.inspirations';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const INSPIRATION_ROUTE = 'habits/h2/inspiration';

export const isInspirationKind = isOneOf(INSPIRATION_KINDS);

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = isArrayOf(isString);

function isInspiration(value: unknown): value is Inspiration {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['text'] === 'string' &&
    isInspirationKind(candidate['kind']) &&
    isOptionalString(candidate['source']) &&
    isStringArray(candidate['tags']) &&
    isOptionalBoolean(candidate['favourite']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isInspirationArray = isArrayOf(isInspiration);

/** Registers the model, the exercise and its mission input, a no-op if already done (Vitest runs
 * with `isolate: false`). */
export function registerInspirationModel(): void {
  if (getRegisteredModels().some((model) => model.key === INSPIRATION_MODEL_KEY)) {
    return;
  }
  registerModel<Inspiration[]>({
    key: INSPIRATION_MODEL_KEY,
    path: INSPIRATION_PATH,
    defaults: () => [],
    validate: isInspirationArray,
  });
  registerExercise({
    exerciseId: INSPIRATION_MODEL_KEY,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-inspiration.title',
    shortTitleKey: 'habits.exercises.h2-inspiration.shortTitle',
    icon: 'format_quote',
    route: INSPIRATION_ROUTE,
    order: 40,
    isStarted: storeStartedFactory<Inspiration[]>(INSPIRATION_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<Inspiration[]>(INSPIRATION_MODEL_KEY, hubStatus),
  });
  registerMissionInput({
    sourceExerciseId: INSPIRATION_MODEL_KEY,
    kind: 'inspiration',
    read: storeInputFactory<Inspiration[]>(INSPIRATION_MODEL_KEY, forMission),
  });
}

registerInspirationModel();
