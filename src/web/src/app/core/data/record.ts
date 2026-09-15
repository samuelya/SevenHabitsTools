/** Fields every record in the document carries. Records are never hard-deleted, only tombstoned. */
export interface BaseRecord {
  readonly id: string;
  readonly createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Creates a new record with a fresh UUID v4 id and matching `createdAt`/`updatedAt`. */
export function newRecord<T extends object>(fields: T): T & BaseRecord {
  const now = new Date().toISOString();
  return { ...fields, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

/** Returns a copy of `record` with `updatedAt` refreshed to now. */
export function touch<T extends BaseRecord>(record: T): T {
  return { ...record, updatedAt: new Date().toISOString() };
}

/** Returns a copy of `record` tombstoned (`deletedAt` set) rather than removed. */
export function softDelete<T extends BaseRecord>(record: T): T {
  const now = new Date().toISOString();
  return { ...record, updatedAt: now, deletedAt: now };
}

/** True when `record` has not been tombstoned. */
export function isLive(record: BaseRecord): boolean {
  return record.deletedAt === undefined;
}
