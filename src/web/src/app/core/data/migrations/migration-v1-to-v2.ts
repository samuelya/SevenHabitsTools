import { Migration } from './migration';

/**
 * v1 → v2 (issue #222): `paradigms-maturity` accepts a new area key, `friendships`. Every v1
 * document is already a valid v2 one, so this only stamps the version. The bump is what matters:
 * a build that only knows v1 would reject a document holding `friendships` as corrupt (its
 * `validate()` doesn't know the key); at v2 it reports "made by a newer version" instead, on load
 * and on import.
 */
export const MIGRATION_V1_TO_V2: Migration = {
  from: 1,
  to: 2,
  migrate: (doc) => ({ ...doc, schemaVersion: 2 }),
};
