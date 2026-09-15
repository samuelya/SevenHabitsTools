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

## Store, persistence and bootstrap

- `DocumentStore` (`document.store.ts`) holds the document as a signal. Read through `select(path)`
  or the typed `featureStore<T>(key)` facade (`feature-store.ts`), resolved from a feature's
  `registerModel()` registration. Write through `update(path, updater)`, `upsertRecord(path, record)`
  and `softDeleteRecord(path, id)` — nothing else mutates the document. Timestamps come from the
  injected `Clock` (`core/time/clock.ts`), not `new Date()` directly, so tests can fix the time.
  `update()` stamps `updatedAt` on the value at `path` (or, for a collection, on the changed
  elements) and on the nearest enclosing record, if any — editing `habits.h2.mission.statement`
  still stamps `mission`, not just `meta`. A path that crosses an existing array or primitive
  (e.g. `shared.roles.0.name`) throws rather than silently replacing it; go through `upsertRecord`
  for a single record in a collection instead.
- `StorageAdapter` (`storage-adapter.ts`) is the persistence seam: `load()`, `save(doc, { reason })`,
  `clear()`, `kind`. Every implementation — `NoopAdapter` (the in-memory stand-in used by tests and,
  until #35 lands, the app itself), the IndexedDB adapter, OneDrive and Google Drive later — must
  pass `describeStorageAdapterContract()` (`storage-adapter.contract.ts`).
- `DocumentPersistence` (`document-persistence.ts`) watches the store and saves through the adapter:
  debounced 500 ms after an edit, flushed immediately on `visibilitychange` → hidden and `pagehide`.
  A single save loop is shared by the debounce timer and `flush()`, so an edit made while a save is
  already in flight is saved once that save completes instead of being dropped. A failed save is
  caught and retried after `SAVE_RETRY_MS`. Saving is disabled while `DocumentBootstrapStatus`
  reports `corrupt`, so the stored document is never overwritten before the user resolves it.
  `dirty`/`lastSavedAt`/`saveError` are exposed for a UI status indicator.
- `document-bootstrap.ts` loads the document on startup (an app initializer in `app.config.ts`):
  nothing stored → `createEmptyDocument()`; a load failure, a migration failure, or a document at
  the current schema version with an invalid shape (`isRootDocumentShape()`,
  `document.model.ts`) or a registered model that fails its own `validate()` → `DocumentBootstrapStatus`
  reports `corrupt` and `App` renders `DataErrorPage` instead of the shell: export the raw file, or
  reset (behind a confirmation step, since it permanently clears storage).
