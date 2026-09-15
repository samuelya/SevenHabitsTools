import { Injectable, Signal, inject } from '@angular/core';
import { FileDownloader } from '../../browser/file-download';
import { WebShareApi, WEB_SHARE } from '../../browser/web-share';
import { CLOCK } from '../../time/clock';
import { getAtPath, setAtPath } from '../document-path.utils';
import { DocumentBootstrapStatus } from '../document-bootstrap-status';
import { resolveDocument } from '../document-validation';
import { RootDocument } from '../document.model';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { DocumentSync } from '../document-sync';
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
  /** The exported snapshot's own `meta.updatedAt` — see `recordLastExportedAt()`. */
  readonly exportedAsOf: string;
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
  private readonly downloader = inject(FileDownloader);
  private readonly webShare: WebShareApi | null = inject(WEB_SHARE);
  private readonly clock = inject(CLOCK);

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
   * records `settings.backup.lastExportedAt`. Returns the filename used, for the caller to
   * confirm to the user. Always downloads — `shareDocument()` is the separate, explicit action
   * for sharing instead. */
  async exportDocument(): Promise<string> {
    const { filename, content, exportedAsOf } = this.buildExportContent();
    this.downloader.download(filename, content);
    this.recordLastExportedAt(exportedAsOf);
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
    const { filename, content, exportedAsOf } = this.buildExportContent();
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
    this.recordLastExportedAt(exportedAsOf);
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
    };
  }

  /**
   * Records `settings.backup.lastExportedAt` as `exportedAsOf` — the exported snapshot's own
   * `meta.updatedAt`, not the time export was clicked — through `DocumentStore.replaceDocument()`
   * rather than `update()`. `update()` always re-stamps `meta.updatedAt` to the moment of the
   * write itself; using it here would make this bookkeeping edit look like a content change and
   * immediately re-arm the reminder banner (#152). Reads the document fresh rather than reusing
   * the snapshot `buildExportContent()` captured, so a concurrent edit during the export's
   * `await` (sharing/downloading) is never clobbered.
   */
  private recordLastExportedAt(exportedAsOf: string): void {
    const latest = this.store.document() as unknown as Record<string, unknown>;
    const current = getAtPath<BackupSettings>(latest, BACKUP_PATH) ?? { reminderDays: 7 };
    const updated: BackupSettings = { ...current, lastExportedAt: exportedAsOf };
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

  /** Replaces the whole document with `imported`. Returns `false`, leaving the document untouched,
   * for a read-only tab. */
  async replaceWithImport(imported: RootDocument): Promise<boolean> {
    return this.applyImport(imported);
  }

  /**
   * Commits `document` as the whole document and saves it immediately, so a reload right after
   * import keeps it rather than depending on the debounce timer or the next edit. If bootstrap had
   * reported the previous document corrupt, this also recovers exactly the way `DataErrorPage.reset()`
   * does: report `ready` and start `DocumentSync` (autosave, the writer lock, cross-tab sync, ...),
   * which never started while the document was corrupt (#37's lead note on this path).
   *
   * The `canImport` (writer-lock) gate only applies to that already-`ready` case: while corrupt,
   * `DocumentSync` — and with it `WriterLockService` — has never started (`app.config.ts` only
   * starts it once bootstrap resolves to `ready`), so `canImport` is always `false` there. Gating
   * on it would make the corrupt-recovery import unreachable (#150); there is no legitimate other
   * writer to defer to in that state either, the same reason `DataErrorPage.reset()` never checks
   * it.
   */
  private async applyImport(document: RootDocument): Promise<boolean> {
    const wasCorrupt = this.bootstrapStatus.state() === 'corrupt';
    if (!wasCorrupt && !this.canImport()) {
      return false;
    }
    this.store.replaceDocument(document);
    if (wasCorrupt) {
      this.bootstrapStatus.reportReady();
      this.documentSync.start();
    }
    await this.persistence.saveNow();
    return true;
  }
}
