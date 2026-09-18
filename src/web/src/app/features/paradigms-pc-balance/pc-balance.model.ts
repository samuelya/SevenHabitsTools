import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';

/** The three asset groups the audit covers (issue #49). Stored as a key, never translated text
 * (architecture issue #1 §6). */
export const PC_BALANCE_GROUPS = ['physical', 'financial', 'human'] as const;
export type PcBalanceGroup = (typeof PC_BALANCE_GROUPS)[number];

/**
 * One asset inside an audit. A nested value object, not a record: it's only ever edited through
 * its parent audit, which is the merge unit (architecture issue #1 §6). `key` is a plain string
 * used only as a stable `track` id — never a `BaseRecord.id`.
 */
export interface PcAsset {
  readonly key: string;
  readonly name: string;
  readonly group: PcBalanceGroup;
  readonly p: number;
  readonly pc: number;
  /** Required, through form validation and `isAssetComplete()`, once the asset is over-used
   * (issue #49's implementation notes) — never enforced here, which only checks structure. */
  readonly action?: string;
}

/** One P/PC audit (issue #49): a dated, repeatable assessment record. */
export interface PcAudit extends BaseRecord {
  readonly date: string;
  readonly assets: readonly PcAsset[];
  readonly reflection: string;
}

/** The fields a caller supplies when creating an audit; base record fields come from
 * `newRecord()`. */
export type PcAuditFields = Omit<PcAudit, keyof BaseRecord>;

/** The model key `featureStore<PcAudit[]>()` callers resolve, and this exercise's `exerciseId`
 * (playbook §1: the model key is always the `exerciseId`). */
export const PC_BALANCE_MODEL_KEY = 'paradigms-pc-balance';

/** The document path this model lives at (issue #49's data model). */
export const PC_BALANCE_PATH = 'habits.paradigms.pcAudits';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below) —
 * shared with `pc-balance-page.ts`'s own navigation so the two can never drift apart. */
export const PC_BALANCE_ROUTE = 'habits/paradigms/pc-balance';

const isPcBalanceGroup = isOneOf(PC_BALANCE_GROUPS);

function isPcAsset(value: unknown): value is PcAsset {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['key'] === 'string' &&
    typeof candidate['name'] === 'string' &&
    isPcBalanceGroup(candidate['group']) &&
    typeof candidate['p'] === 'number' &&
    typeof candidate['pc'] === 'number' &&
    isOptionalString(candidate['action'])
  );
}

const isPcAssetArray = isArrayOf(isPcAsset);

function isPcAudit(value: unknown): value is PcAudit {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['date'] === 'string' &&
    isPcAssetArray(candidate['assets']) &&
    typeof candidate['reflection'] === 'string'
  );
}

const isPcAuditArray = isArrayOf(isPcAudit);

/**
 * Registers the `paradigms-pc-balance` model and exercise, a no-op if already done — same
 * idempotent guard as `registerTransitionModel()` (`transition.model.ts`), needed because this
 * project's unit tests run with Vitest `isolate: false` (shared module state across spec files).
 */
export function registerPcBalanceModel(): void {
  if (getRegisteredModels().some((model) => model.key === PC_BALANCE_MODEL_KEY)) {
    return;
  }
  registerModel<PcAudit[]>({
    key: PC_BALANCE_MODEL_KEY,
    path: PC_BALANCE_PATH,
    defaults: () => [],
    validate: isPcAuditArray,
  });
  registerExercise({
    exerciseId: PC_BALANCE_MODEL_KEY,
    habit: 'paradigms',
    titleKey: 'habits.exercises.paradigms-pc-balance.title',
    summaryKey: 'habits.exercises.paradigms-pc-balance.summary',
    icon: 'balance',
    route: PC_BALANCE_ROUTE,
  });
}

registerPcBalanceModel();
