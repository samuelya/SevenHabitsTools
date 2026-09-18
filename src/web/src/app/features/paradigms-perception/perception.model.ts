import { BaseRecord } from '../../core/data/record';
import { isArrayOf, isBaseRecord, isOneOf } from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';

/** Whether one change attempt (step 2) relied on a quick fix or a principle the user built into
 * themselves (issue #48). Stored as a key, never translated text (architecture issue #1 §6). */
export const CHANGE_ATTEMPT_KINDS = ['technique', 'character'] as const;
export type ChangeAttemptKind = (typeof CHANGE_ATTEMPT_KINDS)[number];

/**
 * One of the 3 recent change attempts the user names in step 2. A nested value object, not a
 * record: it's only ever edited through its parent exercise, which is the merge unit
 * (architecture issue #1 §6).
 */
export interface ChangeAttempt {
  readonly text: string;
  readonly kind: ChangeAttemptKind;
}

/** A see → do → get chain (step 3), for the user's current paradigm or the alternative one. */
export interface PerceptionChain {
  readonly see: string;
  readonly do: string;
  readonly get: string;
}

/** The valid range of `switchDifficulty` once the user has actually rated it — `null` is "not yet
 * rated", the `number | null` convention used elsewhere in this codebase (e.g.
 * `pc-balance.logic.ts`'s `averageOf`) rather than an in-band sentinel a slider could be
 * mistaken for a real answer. */
export const SWITCH_DIFFICULTY_MIN = 1;
export const SWITCH_DIFFICULTY_MAX = 5;

/**
 * The single worksheet record for this exercise (issue #48, the playbook's **worksheet** type):
 * created on the first edit, never a list the user adds to. `viewBRevealed` persists step 1's
 * "show the alternative" moment as part of the record itself, not page-local UI state: a plain
 * component signal would desync from what the user has actually seen once Angular destroys and
 * recreates `PerceptionPage` on navigating away and back (no custom `RouteReuseStrategy` for this
 * route), resetting to `false` even though `firstView` was already saved (review finding on this
 * PR).
 */
export interface PerceptionExercise extends BaseRecord {
  readonly firstView: string;
  readonly viewBRevealed: boolean;
  readonly switchDifficulty: number | null;
  /** Exactly 3 (`perception.logic.ts`'s `blankChangeAttempts()`); `validate()` checks the count. */
  readonly changeAttempts: readonly ChangeAttempt[];
  readonly difference: string;
  readonly chain: PerceptionChain;
  readonly chainAlt: PerceptionChain;
  readonly reflection: string;
}

/** The model key `featureStore<PerceptionExercise | null>()` callers resolve, and this exercise's
 * `exerciseId` (playbook §1: the model key is always the `exerciseId`). */
export const PERCEPTION_MODEL_KEY = 'paradigms-perception';

/** The document path this model lives at (issue #48's data model). */
export const PERCEPTION_PATH = 'habits.paradigms.perception';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below) —
 * shared with `perception-page.ts`'s own navigation so the two can never drift apart. */
export const PERCEPTION_ROUTE = 'habits/paradigms/perception';

const isChangeAttemptKind = isOneOf(CHANGE_ATTEMPT_KINDS);

function isChangeAttempt(value: unknown): value is ChangeAttempt {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate['text'] === 'string' && isChangeAttemptKind(candidate['kind']);
}

const isChangeAttemptArray = isArrayOf(isChangeAttempt);

function isSwitchDifficulty(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && value >= SWITCH_DIFFICULTY_MIN && value <= SWITCH_DIFFICULTY_MAX)
  );
}

function isPerceptionChain(value: unknown): value is PerceptionChain {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['see'] === 'string' &&
    typeof candidate['do'] === 'string' &&
    typeof candidate['get'] === 'string'
  );
}

function isPerceptionExercise(value: unknown): value is PerceptionExercise {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['firstView'] === 'string' &&
    typeof candidate['viewBRevealed'] === 'boolean' &&
    isSwitchDifficulty(candidate['switchDifficulty']) &&
    isChangeAttemptArray(candidate['changeAttempts']) &&
    candidate['changeAttempts'].length === 3 &&
    typeof candidate['difference'] === 'string' &&
    isPerceptionChain(candidate['chain']) &&
    isPerceptionChain(candidate['chainAlt']) &&
    typeof candidate['reflection'] === 'string'
  );
}

/**
 * Registers the `paradigms-perception` model and exercise, a no-op if already done — same
 * idempotent guard as `registerTransitionModel()` (`transition.model.ts`), needed because this
 * project's unit tests run with Vitest `isolate: false` (shared module state across spec files).
 */
export function registerPerceptionModel(): void {
  if (getRegisteredModels().some((model) => model.key === PERCEPTION_MODEL_KEY)) {
    return;
  }
  registerModel<PerceptionExercise | null>({
    key: PERCEPTION_MODEL_KEY,
    path: PERCEPTION_PATH,
    defaults: () => null,
    validate: (value) => value === null || isPerceptionExercise(value),
  });
  registerExercise({
    exerciseId: PERCEPTION_MODEL_KEY,
    habit: 'paradigms',
    titleKey: 'habits.exercises.paradigms-perception.title',
    summaryKey: 'habits.exercises.paradigms-perception.summary',
    icon: 'visibility',
    route: PERCEPTION_ROUTE,
  });
}

registerPerceptionModel();
