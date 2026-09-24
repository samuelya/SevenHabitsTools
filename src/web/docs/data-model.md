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
- The registrations themselves live in a module-level map, so every `<feature>.model.ts` a spec
  imports (even transitively, e.g. through `app.config.ts`) registers itself for the lifetime of
  that module graph, and — since `registerModel()`'s module-level call only ever runs once — won't
  register itself again if something clears it. Two defences, kept together on purpose:
  - `npm test` runs with `isolate: true` (`angular.json`), so each spec file gets its own fresh
    module graph — and therefore its own registry — instead of sharing one (and racing
    `resetRegistryForTesting()` calls) across every spec file in the run.
  - Within a single file, a test that needs to register its own temporary fixtures still shouldn't
    wipe out real registrations another module in _that_ file's graph already made (e.g.
    `settings.model.ts`, `core/pwa/pwa.model.ts`, both imported transitively through
    `app.config.ts`). `snapshotRegistryForTesting()` / `resetRegistryForTesting(snapshot)` save and
    restore exactly what was there before, instead of leaving it empty — see `registry.spec.ts` and
    `feature-store.spec.ts` for the `beforeEach`/`afterEach` pattern.

This is what lets independent feature PRs land without touching a shared schema file.

## Migrations

`schemaVersion` is an integer, bumped on any breaking change to the root shape or a model's
stored shape. Widening a model's `validate()` to accept values an older build rejects (a new enum
value, such as #222's `friendships` area key) counts as breaking too: without the bump, an older
build would reject a new document as corrupt instead of reporting "made by a newer version". So
does a changed **meaning** of a stored value that `validate()` still accepts (#223: an asset `key`
of `sleep` with `name: ''` is a built-in asset; an older build reads it as a blank custom asset and
loses the built-in identity when it copies the audit). So does a new optional field an older build
would ignore but misread (#232: `sample: true` on a script or teach entry counts toward nothing;
an older build counts it and keeps the flag through its edits). Such a migration only stamps the
version (`migration-v1-to-v2.ts`, `migration-v2-to-v3.ts`, `migration-v3-to-v4.ts`).
`src/app/core/data/migrations/`:

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

`document-validation.ts`'s `resolveDocument(raw)` runs `migrateDocument()` then
`isRootDocumentShape()` plus every model's `validate()` in one place, so a loaded document
(`document-bootstrap.ts`) and an imported one (`core/data/backup/document-import-export.service.ts`,
issue #37) are held to exactly the same rule instead of a copy of it each.

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
  reset ("Start fresh", behind a confirmation step). Reset calls `adapter.clear()`, which removes
  only the current document: `IndexedDbAdapter` keeps `backup-previous` (the last good save before
  the corrupt one). There is no restore UI yet. The first save after a reset leaves the backup alone
  (there is no `current` to rotate), but the second save rotates the fresh document into
  `backup-previous`. So the old backup lasts until the user's second save after "Start fresh".

## Multi-tab (`core/data/multi-tab/`, `core/data/indexeddb/`)

`IndexedDbAdapter` stores the document in IndexedDB (database `sevenhabits`, store `documents`,
key `current`); each save also copies the previous `current` into `backup-previous` first, in the
same read-write transaction, so a failed or interrupted write can never leave `current`
half-written. `clear()` deletes `current` only and never `backup-previous`. Every call is queued
onto a private promise chain so overlapping calls still run, and complete, in call order.

Because IndexedDB is per-browser rather than per-tab, two tabs saving independently would
overwrite each other, so exactly one tab at a time is allowed to save:

- `WriterLockService` is this tab's single cross-tab write lock, bound to the `WRITER_LOCK` token
  (`writer-lock.ts`) that `DocumentStore`, `DocumentPersistence`, `ReadOnlyBanner` and
  `CrossTabSync` all read through. That token is a narrow `{ role, isWriter }` view, not the lock's
  lifecycle. `role` is `pending` until the lock request settles, then `reader` or `writer`.
  `WriterLockService` picks a `WriterLockStrategy` once, by feature detection:
  - `WebLocksWriterLock` (`navigator.locks`, released automatically when the tab closes) when
    available. It first asks with `ifAvailable: true`: granted means writer from the start; `null`
    means a confirmed reader, which then queues a normal waiting request.
  - Otherwise `HeartbeatWriterLock`, a `localStorage` entry naming the writer's unique tab id. The
    writer renews it every `HEARTBEAT_INTERVAL_MS`, steps down if the entry names another tab, and
    removes its own entry on `pagehide`. Any other tab may claim an entry that is missing or older
    than `HEARTBEAT_STALE_MS` (check and write in one step, then read back after
    `CLAIM_CONFIRM_DELAY_MS`). `localStorage` has no real compare-and-swap, so this fallback is
    best-effort, not exact.
- Both strategies report what their lock did to one `WriterRoleState` (`writer-role-state.ts`),
  which owns the transition rule: `pending → writer` is an initial grant, and only
  `reader → writer` latches `promoted`. Neither strategy decides what a promotion is on its own.
- `DocumentStore` refuses `update`/`upsertRecord`/`softDeleteRecord` while `!isWriter()` (a reader,
  or a tab whose lock is still pending), so an edit that could never be saved is never accepted in
  memory. The refused call returns `false` and bumps `refusedEdits`, and `ReadOnlyEditNotifier`
  shows a snackbar saying why. `replaceDocument()` (bootstrap, cross-tab reload, reset) is not an
  edit and is never refused.
- `ReadOnlyBanner` shows a persistent banner while `role() === 'reader'` (not while `pending`).
- `DocumentPersistence` also refuses to mark the document dirty or call `adapter.save()` while
  `!isWriter()` (the same two-layer pattern used for the corrupt-document gate), so a read-only tab
  can never overwrite what the writer just saved.
- **Known limit, mitigated (#143):** `localStorage` has no real compare-and-swap, so a heartbeat
  writer whose tab was throttled (e.g. backgrounded) for more than `HEARTBEAT_STALE_MS` can lose the
  lock to another tab without ever choosing to give it up, stranding any unsaved edit. `DocumentPersistence`
  watches for `isWriter()` going from `true` to `false` while `dirty`, and if so sets `saveError` to a
  `StrandedEditsError` — surfaced the same way a failed `adapter.save()` is, via `SaveErrorNotifier`'s
  "Export now" snackbar and `UnsavedChangesGuard`'s `beforeunload` prompt — instead of leaving the
  edits dirty with no explanation. This surfaces the loss; it doesn't prevent it, and `CrossTabSync`
  reloading this tab's document once the new writer next saves would still discard the in-memory
  edit if the user hasn't exported by then. With the Web Locks strategy this path never fires in
  practice: the browser never revokes a granted lock.
- `CrossTabSync` broadcasts (`BroadcastChannel`) once the writer's save completes, and reloads the
  document via the adapter (`DocumentStore.replaceDocument`) on every other tab that receives it —
  never marking that tab dirty, since the reload goes through the same gate above.
- `WriterPromotionReload` reloads the page, once, when the lock's `promoted` signal becomes true
  (the previous writer's tab closed): rather than resuming with a possibly-stale in-memory
  document, a full reload re-runs bootstrap against whatever is actually stored. It uses no timers,
  and a slow initial grant never counts as a promotion.
- `DocumentSync` (`document-sync.ts`) starts all of the above, plus `SaveErrorNotifier`, `UnsavedChangesGuard` and `ReadOnlyEditNotifier`,
  once bootstrap resolves
  to `ready`. Called from `app.config.ts` and `DataErrorPage.reset()` — the two places that also
  start `DocumentPersistence` — so a new document-dependent service plugs in by adding one line to
  `DocumentSync`, not by editing either caller.
- `SaveErrorNotifier` shows a snackbar with "Export now" and "Dismiss" when a save fails. It
  doesn't reopen for retries of the same unsaved document, but it does reopen when edits made after
  the user closed it also fail to save (`shouldShowSaveError()`, `save-error-notifier.logic.ts`).
- `UnsavedChangesGuard` registers a `beforeunload` prompt only while `dirty && saveError`, so closing
  or reloading the tab asks for confirmation before failed edits are lost.
- Both notifiers open snackbars through `AppSnackbar` (`core/layout/app-snackbar.ts`). It loads
  Angular Material's snackbar outside the initial bundle (preloaded right after startup, so it can
  still open offline) and adds the
  `app-snackbar` panel class. Under 600 px, `styles.scss` uses that class to lift the snackbar above
  the bottom navigation, including `env(safe-area-inset-bottom)`.
- `StoragePersistenceService` (`storage-persistence.service.ts`) wraps `navigator.storage`:
  requests persistent storage on startup and exposes the usage/quota estimate shown in Settings.

Browser APIs (`indexedDB`, `navigator.locks`, `BroadcastChannel`, `navigator.storage`,
`localStorage`) are all behind `InjectionToken`s in `core/browser/`, `undefined`/`null` in
environments without them (including the unit-test `jsdom` environment), so every strategy above
has a unit-testable fallback path and the whole stack degrades gracefully rather than throwing.

## JSON export/import (`core/data/backup/`, issue #37)

- `backup.model.ts` registers `settings.backup { lastExportedAt?, lastExportedDocumentUpdatedAt?,
reminderDays: 0 | 1 | 7 | 30 }` (`0` turns the reminder off) the same way any other feature model
  does. The two export timestamps are deliberately separate (#159): `lastExportedAt` is wall-clock
  time the export happened — the anchor `export-reminder.logic.ts` measures `reminderDays` from;
  `lastExportedDocumentUpdatedAt` is the exported snapshot's own `meta.updatedAt` — used only to
  detect whether the document has changed since. They drift apart whenever a document is exported
  long after its last edit; conflating them (an earlier version of this feature did) anchors the
  reminder interval to the old edit instead of the export itself.
- `DocumentImportExportService` (`document-import-export.service.ts`) is the one place that
  touches the document for export/import:
  - `exportDocument()` always downloads the current document as pretty-printed JSON with an added
    `meta.exportedAt`, and records both `settings.backup` timestamps above. `shareDocument()` is a
    separate, explicit action that shares instead, only where `core/browser/web-share.ts` reports
    a Web Share capability (`canShare`) — it never silently replaces the download (some platforms,
    e.g. desktop Safari, implement `navigator.share`/`canShare` but only open a share sheet, not a
    file save).
  - `parseImportFile(raw)` runs a file's text through `resolveDocument()` — the same path
    `document-bootstrap.ts` uses — and, on success, a per-model-registry preview
    (`import-preview.logic.ts`).
  - `replaceWithImport()` commits the result through `DocumentStore.replaceDocument()` and
    `DocumentPersistence.saveNow()` (an immediate save that does not depend on `start()`'s
    `effect()` having already run). Refuses on a read-only tab (`canImport`, mirroring #127's rule
    for edits) — except recovering from a `corrupt` bootstrap, where there is no writer lock yet to
    check (see below). Merge (resolving a conflict between two edited copies) is deferred to Cloud
    Sync's conflict dialog (#45); `core/data/merge.ts`'s design notes from the first attempt at it
    are preserved as a comment on that issue.
  - `DataErrorPage` also offers "Import a backup", the same `parseImportFile()` +
    `replaceWithImport()` path, as one of the few ways to recover from a `corrupt` document besides
    "Start fresh". Applying an import while corrupt reports `ready` and calls
    `DocumentSync.start()`, exactly like `DataErrorPage.reset()` — the same two callers that start
    it (`app.config.ts`'s initializer, `DataErrorPage.reset()`) now also include this recovery
    path. More than one tab can independently be on the error page for the same corrupt document,
    so this recovery path can't assume it's the only one reaching it (#158): after starting
    `DocumentSync`, it explicitly waits for its own writer-lock role to settle (`pending → writer`
    or `pending → reader`, genuinely asynchronous — `navigator.locks.request()`) before deciding
    whether to save. A tab that settles as `reader` (another tab already recovered first) leaves its
    own committed-but-unsaved import for `CrossTabSync` to correct once that other tab's next save
    broadcasts, instead of saving over it.
- The Settings page's `BackupSection` (`features/settings/backup/`) drives export, the optional
  Share… action, the `.json` file picker and the reminder-days setting; a successful parse opens
  the lazily-loaded `ImportConfirmDialog` (Replace, behind a second confirmation like
  `DataErrorPage`'s "Start fresh"; or export the current document first, then re-open) — a failure
  to load that chunk (e.g. offline) shows an error instead of doing nothing. `HomePage` shows the
  reminder banner, dismissible for the rest of the local day (`ExportReminderDismissal`,
  `localStorage`-backed) when `export-reminder.logic.ts`'s `shouldShowExportReminder()` says the
  document has changed since the last export (or was never exported) and `reminderDays` have
  passed since the export itself — never on a read-only tab.
