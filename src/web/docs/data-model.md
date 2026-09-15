# Data model

The user's whole dataset is one JSON document, defined by `RootDocument`
(`src/app/core/data/document.model.ts`) and persisted through the `StorageAdapter`
(IndexedDB for now; see the pinned architecture issue §4).

## Root shape

```
{
  schemaVersion: number,
  meta: { createdAt, updatedAt, appVersion, deviceId },
  profile: {},
  settings: {},
  shared: { <entity>: ... },      // cross-habit entities, e.g. roles, relationships
  habits: { <habitId>: { <feature>: ... } },
  extras: { <feature>: ... },     // dashboard, journal, reminders
}
```

`habitId` is one of the ids in `core/habits/habits.ts` (`paradigms`, `h1`…`h7`,
`interdependence`).

## Records

Every record stored anywhere in the document uses `BaseRecord`
(`src/app/core/data/record.ts`): `id` (UUID v4, `crypto.randomUUID()`), `createdAt`,
`updatedAt` (ISO 8601 UTC), and an optional `deletedAt` tombstone. Records are never hard
deleted — use `softDelete()` so tombstones survive export/import and, later, sync merges.
Helpers: `newRecord()`, `touch()`, `softDelete()`, `isLive()`.

## Model registry

A feature never edits `document.model.ts` directly. Instead its `<feature>.model.ts` calls
`registerModel()` (`src/app/core/data/registry.ts`) once, at module load:

```ts
registerModel({
  key: 'mission',
  path: 'habits.h2.mission',
  defaults: () => ({ statement: '', updatedAt: null }),
  validate: (value) => typeof value === 'object' && value !== null,
});
```

- `key` must be globally unique; `path` is the dot path into `RootDocument` and must also be
  unique.
- `createEmptyDocument()` composes every registration's `defaults()` into a new document at
  `CURRENT_SCHEMA_VERSION`.
- `validateDocument(doc)` runs each registration's `validate()` against its slice of an
  imported document (skipping slices that are absent) and returns a list of issues. It never
  drops or rewrites keys it doesn't recognise — unknown data always survives.

This is what lets independent feature PRs land without touching a shared schema file.

## Migrations

`schemaVersion` is an integer, bumped on any breaking change to the root shape or a model's
stored shape. `src/app/core/data/migrations/`:

- `migration.ts` — the `Migration` interface: `{ from, to, migrate(doc) }`.
- `migrations.ts` — `MIGRATIONS`, the ordered list; add new entries here, never reorder or
  remove old ones.
- `migrate-document.ts` — `migrateDocument(doc, migrations = MIGRATIONS)` walks the list from
  the document's `schemaVersion` up to `CURRENT_SCHEMA_VERSION`, run on load and on import. A
  document with no numeric `schemaVersion` is treated as version 0. A document from a newer
  version than this build understands throws `SchemaVersionTooNewError`, whose message is a
  Labels/Transloco key (`data.migration.schemaTooNew`) for the caller to display.

Add a fixture per schema version under `src/app/testing/fixtures/document-v<n>.json` and a test
that runs it through `migrateDocument()` up to the current version.
