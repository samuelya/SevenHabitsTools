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
import { hubStatus, isStarted, valuesHeard } from './long-view.logic';

/** The four long views (issue #58), stored as a key and translated at render. */
export const LONG_VIEW_SCENARIOS = ['funeral', 'oneYear', 'anniversary', 'lastDay'] as const;
export type LongViewScenario = (typeof LONG_VIEW_SCENARIOS)[number];

/**
 * One prompt's answer: a nested value object, only ever edited through its long view.
 * `promptKey` is one of `PROMPTS[scenario]` (`long-view.logic.ts`), so no label is stored;
 * `speaker` is set only once the user edits a funeral speaker's name (unset shows the slot label).
 */
export interface LongViewAnswer {
  readonly promptKey: string;
  readonly speaker?: string;
  readonly text: string;
  readonly values: readonly string[];
}

/** One long view (issue #58): a dated, repeatable assessment record. */
export interface LongView extends BaseRecord {
  readonly scenario: LongViewScenario;
  /** The day it was written (`YYYY-MM-DD`). */
  readonly date: string;
  /** One per prompt, in prompt order. */
  readonly answers: readonly LongViewAnswer[];
  /** "Reading it back". */
  readonly reflection?: string;
}

export type LongViewFields = Omit<LongView, keyof BaseRecord>;

/** The model key and this exercise's `exerciseId` (playbook §1). */
export const LONG_VIEW_MODEL_KEY = 'h2-long-view';

export const LONG_VIEW_PATH = 'habits.h2.longViews';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const LONG_VIEW_ROUTE = 'habits/h2/long-view';

const isScenario = isOneOf(LONG_VIEW_SCENARIOS);
const isStringArray = isArrayOf((value: unknown): value is string => typeof value === 'string');

function isAnswer(value: unknown): value is LongViewAnswer {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['promptKey'] === 'string' &&
    isOptionalString(candidate['speaker']) &&
    typeof candidate['text'] === 'string' &&
    isStringArray(candidate['values'])
  );
}

const isAnswerArray = isArrayOf(isAnswer);

function isLongView(value: unknown): value is LongView {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    isScenario(candidate['scenario']) &&
    typeof candidate['date'] === 'string' &&
    isAnswerArray(candidate['answers']) &&
    isOptionalString(candidate['reflection'])
  );
}

const isLongViewArray = isArrayOf(isLongView);

/** Registers the model, the exercise and its mission input, a no-op if already done (Vitest runs
 * with `isolate: false`). */
export function registerLongViewModel(): void {
  if (getRegisteredModels().some((model) => model.key === LONG_VIEW_MODEL_KEY)) {
    return;
  }
  registerModel<LongView[]>({
    key: LONG_VIEW_MODEL_KEY,
    path: LONG_VIEW_PATH,
    defaults: () => [],
    validate: isLongViewArray,
  });
  registerExercise({
    exerciseId: LONG_VIEW_MODEL_KEY,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-long-view.title',
    shortTitleKey: 'habits.exercises.h2-long-view.shortTitle',
    icon: 'landscape',
    route: LONG_VIEW_ROUTE,
    order: 10,
    isStarted: storeStartedFactory<LongView[]>(LONG_VIEW_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<LongView[]>(LONG_VIEW_MODEL_KEY, hubStatus),
  });
  registerMissionInput({
    sourceExerciseId: LONG_VIEW_MODEL_KEY,
    kind: 'values',
    read: storeInputFactory<LongView[]>(LONG_VIEW_MODEL_KEY, (list) =>
      valuesHeard(list).map((heard) => ({ id: heard.value.toLowerCase(), text: heard.value })),
    ),
  });
}

registerLongViewModel();
