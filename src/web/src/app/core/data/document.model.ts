import { HabitId } from '../habits/habits';

/** The schema version this build of the app reads and writes. Bump on breaking changes and add a migration. */
export const CURRENT_SCHEMA_VERSION = 1;

export interface DocumentMeta {
  readonly createdAt: string;
  updatedAt: string;
  readonly appVersion: string;
  readonly deviceId: string;
}

/**
 * The user's whole dataset: one JSON document persisted through the `StorageAdapter`.
 * `habits.<habit>.<feature>` holds exercise data; `shared.<entity>` holds cross-habit entities;
 * `extras.<feature>` holds dashboard/journal/reminders data. Feature model files register their
 * slice with `registerModel()` in `registry.ts` instead of editing this interface.
 */
export interface RootDocument {
  schemaVersion: number;
  meta: DocumentMeta;
  profile: Record<string, unknown>;
  settings: Record<string, unknown>;
  shared: Record<string, unknown>;
  habits: Record<HabitId, Record<string, unknown>>;
  extras: Record<string, unknown>;
}
