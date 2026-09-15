import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FileDownloader } from '../../browser/file-download';
import { WINDOW } from '../../browser/window';
import { DEVICE_ID_SOURCE } from '../../device/device-id-source';
import { Labels } from '../../i18n/labels';
import { AppSnackbar } from '../../layout/app-snackbar';
import { DocumentImportExportService } from '../backup/document-import-export.service';
import { DocumentBootstrapStatus } from '../document-bootstrap-status';
import { DocumentStore } from '../document.store';
import { DocumentSync } from '../document-sync';
import { createEmptyDocument } from '../registry';
import { STORAGE_ADAPTER } from '../storage-adapter';

/**
 * Shown by `App` instead of the shell when `DocumentBootstrapStatus` reports the stored document
 * could not be loaded. "Try again" (reload) is the primary, non-destructive action; exporting the
 * raw file is offered when there is data to export; "Import a backup" recovers from a previously
 * exported JSON file, replacing the unreadable document outright (there is nothing valid here to
 * merge with); "Start fresh" — the only irreversible action with no way back — requires a
 * confirmation step (with "Cancel" focused by default) before it clears storage.
 */
@Component({
  selector: 'app-data-error-page',
  imports: [MatButtonModule],
  templateUrl: './data-error-page.html',
  styleUrl: './data-error-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataErrorPage {
  private readonly adapter = inject(STORAGE_ADAPTER);
  private readonly deviceIdSource = inject(DEVICE_ID_SOURCE);
  private readonly downloader = inject(FileDownloader);
  private readonly store = inject(DocumentStore);
  private readonly documentSync = inject(DocumentSync);
  private readonly importExport = inject(DocumentImportExportService);
  private readonly window = inject(WINDOW);
  private readonly snackbar = inject(AppSnackbar);
  protected readonly status = inject(DocumentBootstrapStatus);
  protected readonly labels = inject(Labels);

  protected readonly canExport = computed(() => this.status.raw() !== null);
  protected readonly confirmingReset = signal(false);
  protected readonly importError = signal<string | null>(null);

  private readonly cancelButton = viewChild<HTMLButtonElement>('cancelButton');
  private readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');

  constructor() {
    // Move focus to the safe ("Cancel") option as soon as the confirmation step appears, so a
    // stray keypress right after "Start fresh" cannot also confirm the deletion.
    effect(() => {
      if (this.confirmingReset()) {
        this.cancelButton()?.focus();
      }
    });
  }

  protected retry(): void {
    this.window.location.reload();
  }

  protected exportRaw(): void {
    const raw = this.status.raw();
    if (raw === null) {
      return;
    }
    this.downloader.download('seven-habits-tools-backup.json', JSON.stringify(raw, null, 2));
  }

  protected triggerImport(): void {
    this.importError.set(null);
    this.importInput()?.nativeElement.click();
  }

  protected async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const raw = await file.text();
    const result = this.importExport.parseImportFile(raw);
    if (!result.ok) {
      this.importError.set(this.labels.text(result.messageKey));
      return;
    }
    this.importError.set(null);
    // Recovers the same way reset() does — DocumentImportExportService detects the corrupt state
    // itself and reports ready / starts DocumentSync — except this keeps the imported data instead
    // of discarding it. `false` means another tab already recovered, so this import was refused
    // (#160): this tab either moved to that tab's stored document (and this page is going away,
    // hence the snackbar) or, if that document isn't readable yet, stays here.
    if (await this.importExport.replaceWithImport(result.document)) {
      return;
    }
    if (this.status.state() === 'corrupt') {
      this.importError.set(this.labels.text('data.error.importRefusedRecoveringElsewhere'));
    } else {
      void this.snackbar.open(
        this.labels.text('data.error.importRefusedRecoveredElsewhere'),
        this.labels.text('data.snackbar.dismiss'),
      );
    }
  }

  protected confirmReset(): void {
    this.confirmingReset.set(true);
  }

  protected cancelReset(): void {
    this.confirmingReset.set(false);
  }

  protected async reset(): Promise<void> {
    await this.adapter.clear();
    this.store.replaceDocument(createEmptyDocument(this.deviceIdSource.id()));
    this.confirmingReset.set(false);
    this.status.reportReady();
    // DocumentSync (autosave, the writer lock, cross-tab sync, ...) was never started while the
    // document was corrupt (see `app.config.ts`); start it now so the fresh document gets the
    // full sync stack going forward.
    this.documentSync.start();
  }
}
