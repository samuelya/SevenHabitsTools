import { Migration } from './migration';

/**
 * Ordered migrations, one per schema version bump. `migrateDocument()` walks this list from a
 * document's `schemaVersion` up to `CURRENT_SCHEMA_VERSION`. There is nothing to migrate to
 * reach v1, the first version, so this starts empty; add entries here in order as the schema
 * changes, e.g. `{ from: 1, to: 2, migrate: (doc) => ({ ...doc, schemaVersion: 2 }) }`.
 */
export const MIGRATIONS: readonly Migration[] = [];
