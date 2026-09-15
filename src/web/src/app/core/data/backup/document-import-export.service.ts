import { Injectable, Injector, Signal, effect, inject, runInInjectionContext } from '@angular/core';
import { FileDownloader } from '../../browser/file-download';
import { WebShareApi, WEB_SHARE } from '../../browser/web-share';
import { CLOCK } from '../../time/clock';
import { getAtPath, setAtPath } from '../document-path.utils';
import { bootstrapDocument } from '../document-bootstrap';
import { DocumentBootstrapStatus } from '../document-bootstrap-status';
import { resolveDocument } from '../document-validation';
import { RootDocument } from '../document.model';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { DocumentSync } from '../document-sync';
import { WriterLockService } from '../multi-tab/writer-lock.service';
import { WriterRole } from '../multi-tab/writer-role-state';
import { WRITER_LOCK } from '../multi-tab/writer-lock';
import { BACKUP_PATH, BackupSettings } from './backup.model';
import { buildExportFilename } from './export-filename.utils';
import { buildImportPreview, ImportPreview } from './import-preview.logic';

export type ImportParseResult =
  | { readonly ok: true; readonly document: RootDocument; readonly preview: ImportPreview }
  | { readonly ok: false; readonly messageKey: string };

interface ExportContent {
  readonly filename: string;
  readonly content: string;
  /** The exported snapshot's own `meta.updatedAt` — the content watermark half of
   * `recordLastExportedAt()`'s two arguments. */
  readonly exportedAsOf: string;
  /** Wall-clock time this export happened — the interval-anchor half. */
  readonly exportedAt: string;
}

/**
 * Orchestrates the side effects of exporting and importing the document as JSON: building and
 * downloading (or, on `shareDocument()`, sharing) the file (export), and running an imported file
 * through the shared migrate-then-validate path (`resolveDocument`, also used by
 * `document-bootstrap.ts`) before committing it (import). Parsing/validating a file and deciding
 * whether to apply it are separate steps so the import dialog can show a preview in between;
 * nothing here renders UI.
 */
@Injectable({ providedIn: 'root' })
export class DocumentImportExportService {
  private readonly store = inject(DocumentStore);
  private readonly persistence = inject(DocumentPersistence);
  private readonly bootstrapStatus = inject(DocumentBootstrapStatus);
  private readonly documentSync = inject(DocumentSync);
  private readonly writerLock = inject(WRITER_LOCK);
  /** The lock's lifecycle, which only the corrupt-recovery import needs (`WRITER_LOCK` is read-only). */
  private readonly writerLockService = inject(WriterLockService);
  private readonly downloader = inject(FileDownloader);
  private readonly webShare: WebShareApi | null = inject(WEB_SHARE);
  private readonly clock = inject(CLOCK);
  private readonly injector = inject(Injector);

  /** Only the writer tab may import: a read-only tab's whole-document replace could never be
   * saved, the same reason `DocumentStore` refuses edits there (#127). Export doesn't need this —
   * it only reads the document; the `lastExportedAt` bookkeeping below is best-effort. */
  readonly canImport: Signal<boolean> = this.writerLock.isWriter;

  /** Whether `shareDocument()` has anything to offer — not a `Signal`, since browser support for
   * the Web Share API doesn't change over a page's lifetime. `BackupSection` uses this to show
   * (or hide) a separate, explicit "Share…" action; it never replaces the plain download (#154:
   * on some platforms, e.g. desktop Safari, `navigator.share`/`canShare` exist but only open a
   * share sheet, which most users don't expect from an "export" button). */
  readonly canShare: boolean = this.webShare !== null;

  /** Downloads the current document as pretty-printed JSON with `meta.exportedAt` set, and
   * records the export in `settings.backup` (`recordLastExportedAt()`). Returns the filename used,
   * for the caller to confirm to the user. Always downloads — `shareDocument()` is the separate,
   * explicit action for sharing instead. */
  async exportDocument(): Promise<string> {
    const { filename, content, exportedAsOf, exportedAt } = this.buildExportContent();
    this.downloader.download(filename, content);
    this.recordLastExportedAt(exportedAsOf, exportedAt);
    return filename;
  }

  /** Shares the current document through the Web Share API. Returns `false`, downloading nothing
   * and recording nothing, if the platform can't share it (`canShare` was already `false`, or
   * `navigator.canShare()` itself declines this specific file) or the user cancels the share
   * sheet — the caller decides whether to fall back to `exportDocument()`. */
  async shareDocument(): Promise<boolean> {
    if (!this.webShare) {
      return false;
    }
    const { filename, content, exportedAsOf, exportedAt } = this.buildExportContent();
    const file = new File([content], filename, { type: 'application/json' });
    if (!this.webShare.canShareFiles([file])) {
      return false;
    }
    try {
      await this.webShare.share([file]);
    } catch {
      // The user cancelled the share sheet, or the platform advertised support it doesn't
      // actually have.
      return false;
    }
    this.recordLastExportedAt(exportedAsOf, exportedAt);
    return true;
  }

  private buildExportContent(): ExportContent {
    const now = this.clock.now();
    const document = this.store.document();
    return {
      filename: buildExportFilename(now),
      content: JSON.stringify(
        { ...document, meta: { ...document.meta, exportedAt: now.toISOString() } },
        null,
        2,
      ),
      exportedAsOf: document.meta.updatedAt,
      exportedAt: now.toISOString(),
    };
  }

  /**
   * Records this export in `settings.backup`, through `DocumentStore.replaceDocument()` rather
   * than `update()` — `update()` always re-stamps `meta.updatedAt` to the moment of the write
   * itself, which would make this bookkeeping edit look like a content change and immediately
   * re-arm the reminder banner (#152). Reads the document fresh rather than reusing the snapshot
   * `buildExportContent()` captured, so a concurrent edit during the export's `await`
   * (sharing/downloading) is never clobbered.
   *
   * Two separate values, deliberately never conflated (#159): `exportedAt` (wall-clock time this
   * export happened) is `lastExportedAt`, the anchor `export-reminder.logic.ts` measures
   * `reminderDays` from; `exportedAsOf` (the exported snapshot's own `meta.updatedAt`) is
   * `lastExportedDocumentUpdatedAt`, used only to detect whether the document has changed since
   * that export. A document exported long after its last edit has an `exportedAsOf` far earlier
   * than `exportedAt` — using one value for both would anchor the reminder interval to the old
   * edit instead of the export itself.
   */
  private recordLastExportedAt(exportedAsOf: string, exportedAt: string): void {
    const latest = this.store.document() as unknown as Record<string, unknown>;
    const current = getAtPath<BackupSettings>(latest, BACKUP_PATH) ?? { reminderDays: 7 };
    const updated: BackupSettings = {
      ...current,
      lastExportedAt: exportedAt,
      lastExportedDocumentUpdatedAt: exportedAsOf,
    };
    this.store.replaceDocument(setAtPath(latest, BACKUP_PATH, updated) as unknown as RootDocument);
  }

  /** Parses and validates `raw` (a `.json` file's text) through the same path a loaded document
   * goes through on bootstrap. Never touches the current document — the caller decides what to do
   * with a successful result (`replaceWithImport`). */
  parseImportFile(raw: string): ImportParseResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, messageKey: 'data.import.errors.notJson' };
    }
    const result = resolveDocument(parsed);
    if (!result.ok) {
      const messageKey =
        result.error instanceof Error && result.error.name === 'SchemaVersionTooNewError'
          ? result.error.message
          : 'data.import.errors.invalid';
      return { ok: false, messageKey };
    }
    return { ok: true, document: result.document, preview: buildImportPreview(result.document) };
  }

  /** Replaces the whole document with `imported`. Returns `false`, never applying `imported`, for a
   * read-only tab — including a corrupt-data tab where another tab already recovered (#160). */
  async replaceWithImport(imported: RootDocument): Promise<boolean> {
    return this.applyImport(imported);
  }

  /**
   * Commits `document` as the whole document and saves it immediately, so a reload right after
   * import keeps it rather than depending on the debounce timer or the next edit. Refuses, leaving
   * the document untouched, for a read-only tab — the same reason `DocumentStore` refuses edits
   * there (#127).
   */
  private async applyImport(document: RootDocument): Promise<boolean> {
    if (this.bootstrapStatus.state() === 'corrupt') {
      return this.applyCorruptRecoveryImport(document);
    }
    if (!this.canImport()) {
      return false;
    }
    this.store.replaceDocument(document);
    await this.persistence.saveNow();
    return true;
  }

  /**
   * Recovers from a corrupt document the same way `DataErrorPage.reset()` does — commits
   * `document`, reports `ready`, and starts `DocumentSync` (autosave, cross-tab sync, ...), which
   * never runs while the document is corrupt (`app.config.ts` only starts it once bootstrap
   * resolves to `ready`) — except this keeps the imported data instead of discarding it.
   *
   * `canImport` can't gate this the way it gates an already-`ready` import: the writer lock hasn't
   * started yet, so it always reads `false` here (#150). But every tab that had the same corrupt
   * document is on the error page, and only one of them may recover it (#158). So this starts the
   * lock on its own and commits nothing until its role settles (#160):
   * - `writer`: commit, report ready and save immediately.
   * - `reader`: another tab already recovered. Refuse, and move this tab to that tab's stored
   *   document by re-running the bootstrap load (migrate + validate), exactly as a tab opened now
   *   would. Accepting the import in memory would show data that is never saved and silently
   *   disappears later — the #127 pattern. If the stored document still can't be read (the writer
   *   hasn't finished saving), the tab stays on the error page; "Try again" reloads it.
   */
  private async applyCorruptRecoveryImport(document: RootDocument): Promise<boolean> {
    this.writerLockService.start();
    const role = await this.waitForWriterRole();
    if (role !== 'writer') {
      await runInInjectionContext(this.injector, bootstrapDocument);
      if (this.bootstrapStatus.state() === 'ready') {
        this.documentSync.start();
      }
      return false;
    }
    this.store.replaceDocument(document);
    this.bootstrapStatus.reportReady();
    this.documentSync.start();
    await this.persistence.saveNow();
    return true;
  }

  /** Resolves once the lock's role leaves `pending` — the lock request settling is genuinely
   * asynchronous (`navigator.locks.request()`), so a caller that just started it can't just read
   * `canImport`/`isWriter` synchronously afterwards. */
  private waitForWriterRole(): Promise<WriterRole> {
    return new Promise((resolve) => {
      const ref = effect(
        () => {
          const role = this.writerLockService.role();
          if (role !== 'pending') {
            resolve(role);
            ref.destroy();
          }
        },
        { injector: this.injector },
      );
    });
  }
}
