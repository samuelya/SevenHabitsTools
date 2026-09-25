import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';

/** Who a promise is made to (issue #57). Stored as a key, translated at render. */
export const COMMITMENT_RECIPIENTS = ['self', 'other'] as const;
export type CommitmentRecipient = (typeof COMMITMENT_RECIPIENTS)[number];

/** A promise's state: `open` until the user marks it kept, broken or withdrawn. */
export const COMMITMENT_STATUSES = ['open', 'kept', 'broken', 'withdrawn'] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

/** The statuses a promise can be resolved to (`CommitmentsService.setStatus()`). */
export type CommitmentResolution = Exclude<CommitmentStatus, 'open'>;

/** Which exercise made a promise. `exerciseId` is a plain string, not an enum, so a later source
 * (Habit 3's weekly plan) needs no `validate()` change and no schema bump (issue #57). */
export interface CommitmentSource {
  readonly exerciseId: string;
  readonly recordId?: string;
}

/**
 * One small promise (issue #57): the first `shared.*` entity every Habit 1 tool reads or writes
 * through `CommitmentsService`. `personName`, `resolvedOn` and `repairNote` only mean something in
 * one state each (`other`, resolved, `broken`); `validate()` checks their type only (architecture
 * issue #1 §6: structure, not business rules).
 */
export interface Commitment extends BaseRecord {
  readonly text: string;
  readonly toWhom: CommitmentRecipient;
  readonly personName?: string;
  /** `YYYY-MM-DD`, local. */
  readonly dueDate?: string;
  readonly status: CommitmentStatus;
  /** `YYYY-MM-DD`, local: the day the status left `open`. Cleared on reopen. */
  readonly resolvedOn?: string;
  readonly repairNote?: string;
  readonly source?: CommitmentSource;
  /** A copy of a guide example ("Try this example", issue #232): counts toward nothing until the
   * user edits it. Absent means `false`. */
  readonly sample?: boolean;
}

export type CommitmentFields = Omit<Commitment, keyof BaseRecord>;

/** The model key `featureStore<Commitment[]>()` resolves. Not an `exerciseId`: the slice belongs
 * to no single exercise (playbook §6, "Cross-feature data"). */
export const COMMITMENTS_MODEL_KEY = 'commitments';

/** Architecture issue #1 §6: cross-habit entities live under `shared.*`. */
export const COMMITMENTS_PATH = 'shared.commitments';

export const isCommitmentRecipient = isOneOf(COMMITMENT_RECIPIENTS);
export const isCommitmentStatus = isOneOf(COMMITMENT_STATUSES);

function isOptionalSource(value: unknown): value is CommitmentSource | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const source = value as Record<string, unknown>;
  return typeof source['exerciseId'] === 'string' && isOptionalString(source['recordId']);
}

function isCommitment(value: unknown): value is Commitment {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['text'] === 'string' &&
    isCommitmentRecipient(candidate['toWhom']) &&
    isOptionalString(candidate['personName']) &&
    isOptionalString(candidate['dueDate']) &&
    isCommitmentStatus(candidate['status']) &&
    isOptionalString(candidate['resolvedOn']) &&
    isOptionalString(candidate['repairNote']) &&
    isOptionalSource(candidate['source']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isCommitmentArray = isArrayOf(isCommitment);

/**
 * Registers the `commitments` model, a no-op if already done (Vitest runs with `isolate: false`).
 * Imported eagerly from `model-registry.ts`, not from a lazy route, so the slice is validated on
 * load and import even when no page that uses it has been opened (issue #57's design check).
 */
export function registerCommitmentsModel(): void {
  if (getRegisteredModels().some((model) => model.key === COMMITMENTS_MODEL_KEY)) {
    return;
  }
  registerModel<Commitment[]>({
    key: COMMITMENTS_MODEL_KEY,
    path: COMMITMENTS_PATH,
    defaults: () => [],
    validate: isCommitmentArray,
  });
}

registerCommitmentsModel();
