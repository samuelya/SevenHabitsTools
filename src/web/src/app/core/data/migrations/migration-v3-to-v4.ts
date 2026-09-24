import { Migration } from './migration';

/**
 * v3 → v4 (issue #232): a `paradigms-transition` script or `paradigms-teach` entry may carry
 * `sample: true`, a copy of a guide example that counts toward nothing until the user edits it.
 * `validate()` ignores keys it doesn't know, so every v3 document is a valid v4 one and this only
 * stamps the version. The bump is what matters: a build that only knows v3 would count a sample
 * in the hub status, summaries and done gate, and its edits would keep the flag, so a script the
 * user rewrote there would come back still marked as an example; at v4 it reports "made by a
 * newer version" instead, on load and on import.
 */
export const MIGRATION_V3_TO_V4: Migration = {
  from: 3,
  to: 4,
  migrate: (doc) => ({ ...doc, schemaVersion: 4 }),
};
