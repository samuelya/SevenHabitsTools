import { Migration } from './migration';

/**
 * v2 → v3 (issue #223): a `paradigms-pc-balance` asset whose `key` is a built-in key (`sleep`,
 * `savings`, …) with `name: ''` is a suggested asset, its label translated at render. `validate()`
 * already accepted that shape, so every v2 document is a valid v3 one and this only stamps the
 * version. The bump is what matters: a build that only knows v2 would read such an asset as a
 * blank custom one and give it a fresh key when it copies the audit, losing the built-in for good;
 * at v3 it reports "made by a newer version" instead, on load and on import.
 */
export const MIGRATION_V2_TO_V3: Migration = {
  from: 2,
  to: 3,
  migrate: (doc) => ({ ...doc, schemaVersion: 3 }),
};
