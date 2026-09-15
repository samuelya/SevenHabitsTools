import { CURRENT_SCHEMA_VERSION } from '../document.model';
import { Migration } from './migration';
import { MIGRATIONS } from './migrations';

/** Thrown when a document's `schemaVersion` is newer than this build understands. */
export class SchemaVersionTooNewError extends Error {
  constructor(readonly foundVersion: number) {
    // The message is a Labels/Transloco key, not user-facing text; the caller (e.g. the import
    // dialog) resolves it, matching the placeholder-until-i18n-lands convention in core/i18n.
    super('data.migration.schemaTooNew');
    this.name = 'SchemaVersionTooNewError';
  }
}

/**
 * Runs `migrations` (defaulting to the real `MIGRATIONS` list) over `doc`, in order, until it
 * reaches `CURRENT_SCHEMA_VERSION`. Called on load and on import. Rejects documents from a
 * future version instead of guessing how to downgrade them.
 */
export function migrateDocument(
  doc: Record<string, unknown>,
  migrations: readonly Migration[] = MIGRATIONS,
): Record<string, unknown> {
  const rawVersion = doc['schemaVersion'];
  let version = typeof rawVersion === 'number' ? rawVersion : 0;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SchemaVersionTooNewError(version);
  }

  let current = doc;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations.find((candidate) => candidate.from === version);
    if (!migration) {
      throw new Error(`No migration registered from schema version ${version}`);
    }
    current = migration.migrate(current);
    version = migration.to;
  }
  return current;
}
