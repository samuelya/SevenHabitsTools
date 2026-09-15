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
  `clear()`, `kind`. Every implementation — `NoopAdapter` (the in-memory stand-in used by tests and
  the app itself before #35), `IndexedDbAdapter` (`indexeddb/indexeddb-adapter.ts`, the app's
  adapter now), OneDrive and Google Drive later — must pass `describeStorageAdapterContract()`
  (`storage-adapter.contract.ts`).
- `DocumentPersistence` (`document-persistence.ts`) watches the store and saves through the adapter:
  debounced 500 ms after an edit, flushed immediately on `visibilitychange` → hidden and `pagehide`.
  A single save loop is shared by the debounce timer and `flush()`, so an edit made while a save is
  already in flight is saved once that save completes instead of being dropped. A failed save is
  caught and retried with exponential backoff (`SAVE_RETRY_MS` doubling up to `SAVE_RETRY_MAX_MS`).
  `dirty`/`lastSavedAt`/`saveError` are exposed for a UI status indicator.
  **Two layers guard against overwriting a corrupt document:** `app.config.ts` only calls
  `documentSync.start()` (see below) when bootstrap resolves to `ready` (never for `corrupt`), and,
  in case something starts it anyway, `runSaveLoop()` itself refuses to save while
  `DocumentBootstrapStatus` reports `corrupt`. The same two-layer pattern gates saving on this tab
  holding the write lock (see "Multi-tab" below). `DataErrorPage` calls `documentSync.start()`
  itself once the user resolves the corrupt document (reset); a future JSON-import success path
  must do the same.
- `document-bootstrap.ts` loads the document on startup (an app initializer in `app.config.ts`):
  nothing stored → `createEmptyDocument()`; a load failure, a migration failure, or a document at
  the current schema version with an invalid shape (`isRootDocumentShape()`,
  `document.model.ts`) or a registered model that fails its own `validate()` → `DocumentBootstrapStatus`
  reports `corrupt` and `App` renders `DataErrorPage` instead of the shell: export the raw file, or
  reset (behind a confirmation step, since it permanently clears storage).

## Multi-tab (`core/data/multi-tab/`, `core/data/indexeddb/`)

`IndexedDbAdapter` stores the document in IndexedDB (database `sevenhabits`, store `documents`,
key `current`); each save also copies the previous `current` into `backup-previous` first, in the
same read-write transaction, so a failed or interrupted write can never leave `current`
half-written. Every call is queued onto a private promise chain so overlapping calls still run,
and complete, in call order.

Because IndexedDB is per-browser rather than per-tab, two tabs saving independently would
overwrite each other, so exactly one tab at a time is allowed to save:

- `WriterLockService` is this tab's single cross-tab write lock, bound to the `WRITER_LOCK` token
  (`writer-lock.ts`) that `DocumentPersistence`, `ReadOnlyBanner` and `CrossTabSync` all read
  through — a narrow `{ isWriter: Signal<boolean> }` view, not the lock's lifecycle. It picks a
  `WriterLockStrategy` once, by feature detection: `WebLocksWriterLock` (`navigator.locks.request`,
  released automatically when the tab closes) when available, else `HeartbeatWriterLock` (a
  `localStorage` heartbeat, refreshed every `HEARTBEAT_INTERVAL_MS` and claimed by another tab once
  it goes stale for longer than `HEARTBEAT_STALE_MS`) — `localStorage` has no compare-and-swap, so
  this fallback is best-effort, not exact.
- `ReadOnlyBanner` shows a persistent banner while `!isWriter()`; nothing in `DocumentStore` itself
  knows about tabs.
- `DocumentPersistence` refuses to mark the document dirty or call `adapter.save()` while
  `!isWriter()` (the same two-layer pattern used for the corrupt-document gate), so a read-only tab
  can never overwrite what the writer just saved.
- `CrossTabSync` broadcasts (`BroadcastChannel`) once the writer's save completes, and reloads the
  document via the adapter (`DocumentStore.replaceDocument`) on every other tab that receives it —
  never marking that tab dirty, since the reload goes through the same gate above.
- `WriterPromotionReload` reloads the page when this tab transitions from read-only to writer
  (the previous writer's tab closed): rather than resuming with a possibly-stale in-memory
  document, a full reload re-runs bootstrap against whatever is actually stored.
- `DocumentSync` (`document-sync.ts`) starts all of the above, plus `SaveErrorNotifier` (a snackbar
  with an "export now" action, watching `DocumentPersistence.saveError`), once bootstrap resolves
  to `ready`. Called from `app.config.ts` and `DataErrorPage.reset()` — the two places that also
  start `DocumentPersistence` — so a new document-dependent service plugs in by adding one line to
  `DocumentSync`, not by editing either caller.
- `StoragePersistenceService` (`storage-persistence.service.ts`) wraps `navigator.storage`:
  requests persistent storage on startup and exposes the usage/quota estimate shown in Settings.

Browser APIs (`indexedDB`, `navigator.locks`, `BroadcastChannel`, `navigator.storage`,
`localStorage`) are all behind `InjectionToken`s in `core/browser/`, `undefined`/`null` in
environments without them (including the unit-test `jsdom` environment), so every strategy above
has a unit-testable fallback path and the whole stack degrades gracefully rather than throwing.
