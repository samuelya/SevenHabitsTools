import { isLive, softDelete, touch } from '../../core/data/record';
import { localDateString, parseIsoDate } from '../exercise-kit/assessment-history.logic';
import { isCounted, withoutSample } from '../exercise-kit/sample-record.logic';
import {
  COMMITMENT_STATUSES,
  Commitment,
  CommitmentRecipient,
  CommitmentResolution,
  CommitmentStatus,
} from './commitments.model';

/**
 * The shared, pure half of `shared.commitments` (issue #57): what every Habit 1 tool reads, plus
 * the array edits `CommitmentsService` applies. Dates are local `YYYY-MM-DD` strings passed in by
 * the caller (from `CLOCK`), never read here. Every count and rate is over counted promises only
 * (`isCounted()`: live and not an untouched guide example).
 */

/** Kept and broken promises and the kept rate, a whole percent; `rate` is `null` with none. */
export interface IntegrityRate {
  readonly kept: number;
  readonly broken: number;
  readonly rate: number | null;
}

/** `date` moved by `days` calendar days (negative goes back), local. */
export function addDays(date: string, days: number): string {
  const moved = parseIsoDate(date);
  moved.setDate(moved.getDate() + days);
  return localDateString(moved);
}

/** Kept ÷ (kept + broken), rounded; Open and Withdrawn don't count. With `windowDays`, only
 * promises resolved in the last `windowDays` days up to and including `today` count. */
export function integrityRate(
  list: readonly Commitment[],
  options: { readonly today: string; readonly windowDays?: number },
): IntegrityRate {
  const { today, windowDays } = options;
  const from = windowDays === undefined ? undefined : addDays(today, 1 - windowDays);
  const inWindow = (c: Commitment): boolean =>
    from === undefined ||
    (c.resolvedOn !== undefined && c.resolvedOn >= from && c.resolvedOn <= today);
  const counted = list.filter((c) => isCounted(c) && inWindow(c));
  const kept = counted.filter((c) => c.status === 'kept').length;
  const broken = counted.filter((c) => c.status === 'broken').length;
  const resolved = kept + broken;
  return { kept, broken, rate: resolved === 0 ? null : Math.round((kept / resolved) * 100) };
}

/** Still open with a due date before `today`. */
export function isOverdue(c: Pick<Commitment, 'status' | 'dueDate'>, today: string): boolean {
  return c.status === 'open' && c.dueDate !== undefined && c.dueDate !== '' && c.dueDate < today;
}

/** Due on `date`, whatever its status. */
export function isDueOn(c: Pick<Commitment, 'dueDate'>, date: string): boolean {
  return c.dueDate === date;
}

/** How many counted promises are in each status. */
export function countsByStatus(list: readonly Commitment[]): Record<CommitmentStatus, number> {
  const counts = Object.fromEntries(COMMITMENT_STATUSES.map((status) => [status, 0])) as Record<
    CommitmentStatus,
    number
  >;
  for (const c of list) {
    if (isCounted(c)) {
      counts[c.status] += 1;
    }
  }
  return counts;
}

/** The live promises `exerciseId` made, optionally only those for its record `recordId`. */
export function forSource(
  list: readonly Commitment[],
  exerciseId: string,
  recordId?: string,
): Commitment[] {
  return list.filter(
    (c) =>
      isLive(c) &&
      c.source?.exerciseId === exerciseId &&
      (recordId === undefined || c.source.recordId === recordId),
  );
}

/** Counted promises resolved between `from` and `to`, both inclusive. */
export function resolvedBetween(
  list: readonly Commitment[],
  from: string,
  to: string,
): Commitment[] {
  return list.filter(
    (c) => isCounted(c) && c.resolvedOn !== undefined && c.resolvedOn >= from && c.resolvedOn <= to,
  );
}

/** The fields `update()` may change: the promise itself while open, the repair note while
 * broken. */
export interface CommitmentEdit {
  readonly text?: string;
  readonly dueDate?: string;
  readonly toWhom?: CommitmentRecipient;
  readonly personName?: string;
  readonly repairNote?: string;
}

const OPEN_FIELDS = ['text', 'dueDate', 'toWhom', 'personName'] as const;

/** `record` with every key whose value is `undefined` removed, so a cleared optional field leaves
 * no key behind in the document. */
function compact<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

/** Applies `change` to the live promise `id` and bumps `updatedAt`; any edit makes a sample the
 * user's own (issue #232). Other promises, and a tombstoned or missing `id`, are left alone. */
function changeOne(
  list: readonly Commitment[],
  id: string,
  now: Date,
  change: (c: Commitment) => Commitment | null,
): Commitment[] {
  return list.map((c) => {
    if (c.id !== id || !isLive(c)) {
      return c;
    }
    const changed = change(c);
    return changed === null ? c : touch(compact(withoutSample(changed)), now);
  });
}

/** Edits the promise `id`. The promise's own fields (text, due date, who it's to) change only
 * while it is open; the repair note only while it is broken. An empty due date or name clears
 * it. Returns the list unchanged (same content) when nothing may change. */
export function editCommitment(
  list: readonly Commitment[],
  id: string,
  edit: CommitmentEdit,
  now: Date,
): Commitment[] {
  return changeOne(list, id, now, (c) => {
    const allowed: Record<string, unknown> = {};
    if (c.status === 'open') {
      for (const key of OPEN_FIELDS) {
        if (key in edit) {
          allowed[key] = edit[key] === '' && key !== 'text' ? undefined : edit[key];
        }
      }
    }
    if (c.status === 'broken' && 'repairNote' in edit) {
      allowed['repairNote'] = edit.repairNote === '' ? undefined : edit.repairNote;
    }
    return Object.keys(allowed).length === 0 ? null : ({ ...c, ...allowed } as Commitment);
  });
}

/** Resolves the promise `id` to `status` on `today`. A repair note is kept only for `broken`. */
export function resolveCommitment(
  list: readonly Commitment[],
  id: string,
  status: CommitmentResolution,
  today: string,
  now: Date,
  repairNote?: string,
): Commitment[] {
  return changeOne(list, id, now, (c) => ({
    ...c,
    status,
    resolvedOn: today,
    ...(status === 'broken' && repairNote !== undefined ? { repairNote } : {}),
  }));
}

/** Sets the promise `id` back to open and clears `resolvedOn`. */
export function reopenCommitment(list: readonly Commitment[], id: string, now: Date): Commitment[] {
  return changeOne(list, id, now, (c) =>
    c.status === 'open' ? null : { ...c, status: 'open', resolvedOn: undefined },
  );
}

/** Tombstones the promise `id` (never removed, architecture issue #1 §6). */
export function removeCommitment(list: readonly Commitment[], id: string, now: Date): Commitment[] {
  return list.map((c) => (c.id === id ? softDelete(c, now) : c));
}

/** Undoes `removeCommitment()`. */
export function restoreCommitment(
  list: readonly Commitment[],
  id: string,
  now: Date,
): Commitment[] {
  return list.map((c) =>
    c.id === id && !isLive(c) ? touch(compact({ ...c, deletedAt: undefined }), now) : c,
  );
}
