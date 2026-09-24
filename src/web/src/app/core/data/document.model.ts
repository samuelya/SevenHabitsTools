import { HabitId } from '../habits/habits';

/** The schema version this build of the app reads and writes. Bump on breaking changes, when a
 * shipped model's `validate()` starts accepting values an older build would reject, and when a
 * stored value's meaning changes, and add a migration. v2: `paradigms-maturity`'s `friendships`
 * area key (#222). v3: `paradigms-pc-balance`'s built-in asset keys (#223). */
export const CURRENT_SCHEMA_VERSION = 3;

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Structural check that `value` has the shape of a `RootDocument`: a plain object with a numeric
 * `schemaVersion`, a `meta` object with its four string fields, and `profile`/`settings`/`shared`/
 * `habits`/`extras` all plain objects. Used on load (`document-bootstrap.ts`) so a document at the
 * current schema version with a broken shape — missing `meta`, `habits` not an object, and so on —
 * is treated as corrupt instead of accepted as-is and then overwritten by the first autosave.
 */
export function isRootDocumentShape(value: unknown): value is RootDocument {
  if (!isPlainObject(value) || typeof value['schemaVersion'] !== 'number') {
    return false;
  }
  const meta = value['meta'];
  if (
    !isPlainObject(meta) ||
    typeof meta['createdAt'] !== 'string' ||
    typeof meta['updatedAt'] !== 'string' ||
    typeof meta['appVersion'] !== 'string' ||
    typeof meta['deviceId'] !== 'string'
  ) {
    return false;
  }
  return (
    isPlainObject(value['profile']) &&
    isPlainObject(value['settings']) &&
    isPlainObject(value['shared']) &&
    isPlainObject(value['habits']) &&
    isPlainObject(value['extras'])
  );
}
