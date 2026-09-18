import { BaseRecord } from '../../core/data/record';
import { isArrayOf, isBaseRecord, isOptionalString } from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';

/** The six built-in life areas (issue #50's acceptance criteria). Stored as a key, never
 * translated text (architecture issue #1 §6). */
export const MATURITY_AREA_KEYS = [
  'work',
  'family',
  'money',
  'health',
  'learning',
  'community',
] as const;
export type MaturityAreaKey = (typeof MATURITY_AREA_KEYS)[number];

/** The three-point continuum (issue #50's acceptance criteria): 1 dependence, 2 independence,
 * 3 interdependence. */
export const MATURITY_LEVELS = [1, 2, 3] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];

/**
 * One area inside an assessment. A nested value object, not a record: it's only ever edited
 * through its parent assessment, which is the merge unit (architecture issue #1 §6).
 *
 * `id` is a plain string used only as a stable `track`/reference id — never a `BaseRecord.id` —
 * needed because `key` (below) already means something else here: a built-in area's identifier,
 * present only for a built-in area and absent for a custom one, so it can't double as the track
 * id every area needs (issue #50's implementation notes: "renaming it stores `name` and keeps
 * `key`"; "a custom area stores `name` only").
 */
export interface MaturityArea {
  readonly id: string;
  readonly key?: MaturityAreaKey;
  readonly name?: string;
  /** Unset until the user rates it — a radio group with no default (issue #50's implementation
   * notes). Never enforced here; `validate()` only checks structure. */
  readonly level?: MaturityLevel;
  readonly note?: string;
}

/** One maturity continuum self-assessment (issue #50): a dated, repeatable assessment record. */
export interface MaturityAssessment extends BaseRecord {
  readonly date: string;
  readonly areas: readonly MaturityArea[];
}

/** The fields a caller supplies when creating an assessment; base record fields come from
 * `newRecord()`. */
export type MaturityAssessmentFields = Omit<MaturityAssessment, keyof BaseRecord>;

/** The model key `featureStore<MaturityAssessment[]>()` callers resolve, and this exercise's
 * `exerciseId` (playbook §1: the model key is always the `exerciseId`). */
export const MATURITY_MODEL_KEY = 'paradigms-maturity';

/** The document path this model lives at (issue #50's data model). */
export const MATURITY_PATH = 'habits.paradigms.maturity';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below) —
 * shared with `maturity-page.ts`'s own navigation so the two can never drift apart. */
export const MATURITY_ROUTE = 'habits/paradigms/maturity';

function isMaturityAreaKey(value: unknown): value is MaturityAreaKey {
  return typeof value === 'string' && (MATURITY_AREA_KEYS as readonly string[]).includes(value);
}

function isMaturityLevel(value: unknown): value is MaturityLevel {
  return typeof value === 'number' && (MATURITY_LEVELS as readonly number[]).includes(value);
}

function isOptionalMaturityAreaKey(value: unknown): value is MaturityAreaKey | undefined {
  return value === undefined || isMaturityAreaKey(value);
}

function isOptionalMaturityLevel(value: unknown): value is MaturityLevel | undefined {
  return value === undefined || isMaturityLevel(value);
}

function isMaturityArea(value: unknown): value is MaturityArea {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'string' &&
    isOptionalMaturityAreaKey(candidate['key']) &&
    isOptionalString(candidate['name']) &&
    isOptionalMaturityLevel(candidate['level']) &&
    isOptionalString(candidate['note'])
  );
}

const isMaturityAreaArray = isArrayOf(isMaturityArea);

function isMaturityAssessment(value: unknown): value is MaturityAssessment {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return typeof candidate['date'] === 'string' && isMaturityAreaArray(candidate['areas']);
}

const isMaturityAssessmentArray = isArrayOf(isMaturityAssessment);

/**
 * Registers the `paradigms-maturity` model and exercise, a no-op if already done — same
 * idempotent guard as `registerTransitionModel()` (`transition.model.ts`), needed because this
 * project's unit tests run with Vitest `isolate: false` (shared module state across spec files).
 */
export function registerMaturityModel(): void {
  if (getRegisteredModels().some((model) => model.key === MATURITY_MODEL_KEY)) {
    return;
  }
  registerModel<MaturityAssessment[]>({
    key: MATURITY_MODEL_KEY,
    path: MATURITY_PATH,
    defaults: () => [],
    validate: isMaturityAssessmentArray,
  });
  registerExercise({
    exerciseId: MATURITY_MODEL_KEY,
    habit: 'paradigms',
    titleKey: 'habits.exercises.paradigms-maturity.title',
    summaryKey: 'habits.exercises.paradigms-maturity.summary',
    icon: 'stairs',
    route: MATURITY_ROUTE,
  });
}

registerMaturityModel();
