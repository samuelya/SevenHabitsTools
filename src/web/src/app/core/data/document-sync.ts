import { Injectable, inject } from '@angular/core';
import { IndexedDbUpgradeNotifier } from './indexeddb/indexeddb-upgrade-notifier';
import { CrossTabSync } from './multi-tab/cross-tab-sync';
import { ReadOnlyEditNotifier } from './multi-tab/read-only-edit-notifier';
import { WriterLockService } from './multi-tab/writer-lock.service';
import { WriterPromotionReload } from './multi-tab/writer-promotion-reload';
import { DocumentPersistence } from './document-persistence';
import { SaveErrorNotifier } from './save-error-notifier';
import { UnsavedChangesGuard } from './unsaved-changes-guard';

/**
 * Starts every service that reads or writes the loaded document, once bootstrap has resolved to
 * `ready`: `WriterLockService`'s cross-tab write lock, `DocumentPersistence`'s autosave,
 * `CrossTabSync`'s reload-on-save, `WriterPromotionReload`'s refresh on writer promotion,
 * `SaveErrorNotifier`'s save-error snackbar, `UnsavedChangesGuard`'s close prompt while edits fail to
 * save, `ReadOnlyEditNotifier`'s refused-edit snackbar, and `IndexedDbUpgradeNotifier`'s
 * reload-required snackbar when another tab supersedes this one's database connection. Called from
 * exactly two places — `app.config.ts`'s app initializer after a successful bootstrap, and
 * `DataErrorPage.reset()` once the user has resolved a corrupt document — so a new
 * document-dependent service plugs in by adding one line here, not by editing either caller.
 */
@Injectable({ providedIn: 'root' })
export class DocumentSync {
  private readonly writerLock = inject(WriterLockService);
  private readonly persistence = inject(DocumentPersistence);
  private readonly crossTabSync = inject(CrossTabSync);
  private readonly writerPromotionReload = inject(WriterPromotionReload);
  private readonly saveErrorNotifier = inject(SaveErrorNotifier);
  private readonly unsavedChangesGuard = inject(UnsavedChangesGuard);
  private readonly readOnlyEditNotifier = inject(ReadOnlyEditNotifier);
  private readonly indexedDbUpgradeNotifier = inject(IndexedDbUpgradeNotifier);

  start(): void {
    this.writerLock.start();
    this.persistence.start();
    this.crossTabSync.start();
    this.writerPromotionReload.start();
    this.saveErrorNotifier.start();
    this.unsavedChangesGuard.start();
    this.readOnlyEditNotifier.start();
    this.indexedDbUpgradeNotifier.start();
  }
}
