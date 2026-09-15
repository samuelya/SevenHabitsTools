import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AppDialog } from '../../../core/layout/app-dialog';
import { AppSnackbar } from '../../../core/layout/app-snackbar';
import {
  BACKUP_MODEL_KEY,
  BackupSettings,
  ReminderDays,
} from '../../../core/data/backup/backup.model';
import { DocumentImportExportService } from '../../../core/data/backup/document-import-export.service';
import { ImportPreview } from '../../../core/data/backup/import-preview.logic';
import { featureStore } from '../../../core/data/feature-store';
import { RootDocument } from '../../../core/data/document.model';
import { DocumentStore } from '../../../core/data/document.store';
import type { ImportConfirmDialogData, ImportConfirmDialogResult } from './import-confirm-dialog';

type ImportConfirmDialogModule = typeof import('./import-confirm-dialog');

/** DI seam around the lazy `import('./import-confirm-dialog')`, so a spec can make it reject (the
 * offline/chunk-load-failure test) through a TestBed provider instead of module-level mocking,
 * which the Angular unit-test builder doesn't support for relative imports. */
export const IMPORT_CONFIRM_DIALOG_LOADER = new InjectionToken<
  () => Promise<ImportConfirmDialogModule>
>('IMPORT_CONFIRM_DIALOG_LOADER', {
  providedIn: 'root',
  factory: () => () => import('./import-confirm-dialog'),
});

/**
 * The Settings page's backup controls: export (always downloads, with an "Exported …"
 * confirmation), the separate explicit Share… action (shown only where the Web Share API can
 * actually share a file, #154 — it never replaces the download), import (a file picker feeding
 * `DocumentImportExportService.parseImportFile()`, then the lazily-loaded confirm dialog for
 * Replace) and the reminder-days setting. Owns every side effect the buttons here trigger; the
 * dialog itself stays presentational and reports back what the user chose.
 */
@Component({
  selector: 'app-backup-section',
  imports: [MatButtonModule, TranslocoPipe],
  templateUrl: './backup-section.html',
  styleUrl: './backup-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupSection {
  private readonly transloco = inject(TranslocoService);
  private readonly importExport = inject(DocumentImportExportService);
  private readonly snackbar = inject(AppSnackbar);
  private readonly dialog = inject(AppDialog);
  private readonly loadImportConfirmDialog = inject(IMPORT_CONFIRM_DIALOG_LOADER);
  private readonly documentMeta = inject(DocumentStore).select<RootDocument['meta']>('meta');
  protected readonly backup = featureStore<BackupSettings>(BACKUP_MODEL_KEY);

  protected readonly canImport = this.importExport.canImport;
  protected readonly canShare = this.importExport.canShare;
  protected readonly busy = signal(false);
  protected readonly parseError = signal<string | null>(null);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected async onExportClick(): Promise<void> {
    this.busy.set(true);
    try {
      const filename = await this.importExport.exportDocument();
      await this.snackbar.open(
        this.transloco.translate('settings.backup.exportedSnackbar', { filename }),
        this.transloco.translate('data.snackbar.dismiss'),
        { duration: 4000 },
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async onShareClick(): Promise<void> {
    this.busy.set(true);
    try {
      const shared = await this.importExport.shareDocument();
      if (shared) {
        await this.snackbar.open(
          this.transloco.translate('settings.backup.sharedSnackbar'),
          this.transloco.translate('data.snackbar.dismiss'),
          { duration: 4000 },
        );
      }
      // Not shared (the user cancelled the share sheet, or declined at the last moment): stay
      // silent, the native share UI already gave its own feedback — never fall back to a
      // download the user didn't ask for.
    } finally {
      this.busy.set(false);
    }
  }

  protected triggerImport(): void {
    if (!this.canImport()) {
      this.showReadOnlyMessage();
      return;
    }
    this.parseError.set(null);
    this.fileInput()?.nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be re-selected later
    if (!file) {
      return;
    }
    // Defense in depth alongside triggerImport()'s check: the file input can receive a file
    // without going through that button (e.g. a picker already open when this tab stopped being
    // the writer, or a test driving the input directly, #155).
    if (!this.canImport()) {
      this.showReadOnlyMessage();
      return;
    }
    const raw = await file.text();
    const result = this.importExport.parseImportFile(raw);
    if (!result.ok) {
      this.parseError.set(this.transloco.translate(result.messageKey));
      return;
    }
    this.parseError.set(null);
    await this.confirmAndApplyImport(result.document, result.preview);
  }

  protected onReminderDaysChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value) as ReminderDays;
    this.backup.update((current) => ({ ...current, reminderDays: value }));
  }

  private async confirmAndApplyImport(
    document: RootDocument,
    preview: ImportPreview,
  ): Promise<void> {
    this.busy.set(true);
    try {
      let dialogModule: ImportConfirmDialogModule;
      try {
        dialogModule = await this.loadImportConfirmDialog();
      } catch {
        // Most likely offline with this chunk not yet cached (or a genuine network failure) —
        // say so plainly rather than the import silently going nowhere.
        this.parseError.set(this.transloco.translate('data.import.dialogLoadError'));
        return;
      }
      const { ImportConfirmDialog } = dialogModule;
      const data: ImportConfirmDialogData = {
        preview,
        currentUpdatedAt: this.documentMeta()?.updatedAt ?? '',
      };
      const ref = await this.dialog.open<
        InstanceType<typeof ImportConfirmDialog>,
        ImportConfirmDialogData,
        ImportConfirmDialogResult
      >(ImportConfirmDialog, { data });
      const choice = await firstValueFrom(ref.afterClosed());

      if (choice === 'export-first') {
        await this.onExportClick();
        await this.confirmAndApplyImport(document, preview);
        return;
      }
      if (choice === 'replace') {
        await this.applyAndReport(() => this.importExport.replaceWithImport(document));
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Shows "Import complete." only when `apply` actually applied — `replaceWithImport` returns
   * `false`, leaving the document untouched, if this tab stopped being the writer between opening
   * the dialog and choosing Replace (#155). */
  private async applyAndReport(apply: () => Promise<boolean>): Promise<void> {
    const applied = await apply();
    if (applied) {
      await this.showImportedSnackbar();
    } else {
      this.showReadOnlyMessage();
    }
  }

  private showReadOnlyMessage(): void {
    void this.snackbar.open(
      this.transloco.translate('settings.backup.importReadOnly'),
      this.transloco.translate('data.snackbar.dismiss'),
    );
  }

  private async showImportedSnackbar(): Promise<void> {
    await this.snackbar.open(
      this.transloco.translate('data.import.importedSnackbar'),
      this.transloco.translate('data.snackbar.dismiss'),
      { duration: 4000 },
    );
  }
}
