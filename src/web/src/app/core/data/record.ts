/** Fields every record in the document carries. Records are never hard-deleted, only tombstoned. */
export interface BaseRecord {
  readonly id: string;
  readonly createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/**
 * Creates a new record with a fresh UUID v4 id and matching `createdAt`/`updatedAt`. `now`
 * defaults to the real current time; callers with an injected `Clock` (e.g. `DocumentStore`) pass
 * `clock.now()` so timestamps are testable without racing real time.
 */
export function newRecord<T extends object>(fields: T, now: Date = new Date()): T & BaseRecord {
  const timestamp = now.toISOString();
  return { ...fields, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp };
}

/** Returns a copy of `record` with `updatedAt` refreshed to `now`. */
export function touch<T extends BaseRecord>(record: T, now: Date = new Date()): T {
  return { ...record, updatedAt: now.toISOString() };
}

/** Returns a copy of `record` tombstoned (`deletedAt` set) rather than removed. */
export function softDelete<T extends BaseRecord>(record: T, now: Date = new Date()): T {
  const timestamp = now.toISOString();
  return { ...record, updatedAt: timestamp, deletedAt: timestamp };
}

/** True when `record` has not been tombstoned. */
export function isLive(record: BaseRecord): boolean {
  return record.deletedAt === undefined;
}
