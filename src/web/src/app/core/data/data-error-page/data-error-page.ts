import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FileDownloader } from '../../browser/file-download';
import { DEVICE_ID_SOURCE } from '../../device/device-id-source';
import { Labels } from '../../i18n/labels';
import { DocumentBootstrapStatus } from '../document-bootstrap-status';
import { DocumentStore } from '../document.store';
import { createEmptyDocument } from '../registry';
import { STORAGE_ADAPTER } from '../storage-adapter';

/**
 * Shown by `App` instead of the shell when `DocumentBootstrapStatus` reports the stored document
 * could not be loaded. Offers exporting the raw file (for support, or to try importing it back
 * once fixed) and resetting to a fresh document.
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
  protected readonly status = inject(DocumentBootstrapStatus);
  protected readonly labels = inject(Labels);

  protected readonly canExport = computed(() => this.status.raw() !== null);

  protected exportRaw(): void {
    const raw = this.status.raw();
    if (raw === null) {
      return;
    }
    this.downloader.download('seven-habits-tools-backup.json', JSON.stringify(raw, null, 2));
  }

  protected async reset(): Promise<void> {
    await this.adapter.clear();
    this.store.replaceDocument(createEmptyDocument(this.deviceIdSource.id()));
    this.status.reportReady();
  }
}
