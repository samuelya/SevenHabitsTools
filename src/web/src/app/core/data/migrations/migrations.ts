import { Migration } from './migration';
import { MIGRATION_V1_TO_V2 } from './migration-v1-to-v2';
import { MIGRATION_V2_TO_V3 } from './migration-v2-to-v3';
import { MIGRATION_V3_TO_V4 } from './migration-v3-to-v4';

/**
 * Ordered migrations, one per schema version bump. `migrateDocument()` walks this list from a
 * document's `schemaVersion` up to `CURRENT_SCHEMA_VERSION`. There is nothing to migrate to
 * reach v1, the first version. Add entries here in order as the schema changes, each in its own
 * `migration-v<n>-to-v<n+1>.ts`; never edit or reorder an old one.
 */
export const MIGRATIONS: readonly Migration[] = [
  MIGRATION_V1_TO_V2,
  MIGRATION_V2_TO_V3,
  MIGRATION_V3_TO_V4,
];
