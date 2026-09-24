import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { isStarted } from './transition.logic';

/** Where an inherited script came from. Stored as a key, never translated text (architecture
 * issue #1 §6). */
export const SCRIPT_SOURCES = ['family', 'culture', 'work', 'other'] as const;
export type ScriptSource = (typeof SCRIPT_SOURCES)[number];

/** Whether the script, on balance, helps or harms — or both. */
export const SCRIPT_EFFECTS = ['helps', 'harms', 'mixed'] as const;
export type ScriptEffect = (typeof SCRIPT_EFFECTS)[number];

/** What the user has decided to do with the script going forward. */
export const SCRIPT_DECISIONS = ['keep', 'rewrite', 'stop'] as const;
export type ScriptDecision = (typeof SCRIPT_DECISIONS)[number];

/**
 * One inherited script the user names (issue #51). `newScript`/`situation` are free text the user
 * typed; `transition.logic.ts`'s `isItemComplete()` requires both, but only when `decision` is
 * `'rewrite'` or `'stop'` — `validate()` only checks their type, not that rule (architecture issue
 * #1 §6: "checks structure, not business rules").
 */
export interface Script extends BaseRecord {
  readonly text: string;
  readonly source: ScriptSource;
  readonly effect: ScriptEffect;
  readonly decision: ScriptDecision;
  readonly newScript?: string;
  readonly situation?: string;
}

/** The fields a caller supplies when creating a script; base record fields come from
 * `newRecord()`. */
export type ScriptFields = Omit<Script, keyof BaseRecord>;

/** The model key `featureStore<Script[]>()` callers resolve, and this exercise's `exerciseId`
 * (playbook §1: the model key is always the `exerciseId`). */
export const TRANSITION_MODEL_KEY = 'paradigms-transition';

/** The document path this model lives at (issue #51's data model). */
export const TRANSITION_PATH = 'habits.paradigms.scripts';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below) —
 * shared with `transition-page.ts`'s own navigation so the two can never drift apart. */
export const TRANSITION_ROUTE = 'habits/paradigms/transition';

const isScriptSource = isOneOf(SCRIPT_SOURCES);
const isScriptEffect = isOneOf(SCRIPT_EFFECTS);
const isScriptDecision = isOneOf(SCRIPT_DECISIONS);

function isScript(value: unknown): value is Script {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['text'] === 'string' &&
    isScriptSource(candidate['source']) &&
    isScriptEffect(candidate['effect']) &&
    isScriptDecision(candidate['decision']) &&
    isOptionalString(candidate['newScript']) &&
    isOptionalString(candidate['situation'])
  );
}

const isScriptArray = isArrayOf(isScript);

/**
 * Registers the `paradigms-transition` model and exercise, a no-op if already done — same
 * idempotent guard as `registerExerciseKitModel()` (`shared/exercise-kit/exercise-kit.model.ts`),
 * needed because this project's unit tests run with Vitest `isolate: false` (shared module state
 * across spec files).
 */
export function registerTransitionModel(): void {
  if (getRegisteredModels().some((model) => model.key === TRANSITION_MODEL_KEY)) {
    return;
  }
  registerModel<Script[]>({
    key: TRANSITION_MODEL_KEY,
    path: TRANSITION_PATH,
    defaults: () => [],
    validate: isScriptArray,
  });
  registerExercise({
    exerciseId: TRANSITION_MODEL_KEY,
    habit: 'paradigms',
    titleKey: 'habits.exercises.paradigms-transition.title',
    shortTitleKey: 'habits.exercises.paradigms-transition.shortTitle',
    summaryKey: 'habits.exercises.paradigms-transition.summary',
    icon: 'compare_arrows',
    route: TRANSITION_ROUTE,
    isStarted: storeStartedFactory<Script[]>(TRANSITION_MODEL_KEY, isStarted),
  });
}

registerTransitionModel();
