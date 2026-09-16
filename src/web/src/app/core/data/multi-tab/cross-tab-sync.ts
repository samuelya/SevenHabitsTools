import { Injectable, Injector, effect, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { BROADCAST_CHANNEL_FACTORY } from '../../browser/broadcast-channel';
import { AppSnackbar } from '../../layout/app-snackbar';
import { resolveDocument } from '../document-validation';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { STORAGE_ADAPTER } from '../storage-adapter';
import { WRITER_LOCK } from './writer-lock';

const CHANNEL_NAME = 'sevenhabits-sync';

/**
 * Keeps every tab's in-memory document fresh after another tab saves: the writer broadcasts once
 * a save completes, and every other tab reloads the document from the `StorageAdapter`. Only the
 * writer ever actually saves (`DocumentPersistence` refuses to for a read-only tab), so this class
 * only needs to decide whether an incoming broadcast is for *this* tab to act on — never whether
 * to send one, which follows automatically from watching `DocumentPersistence.lastSavedAt`.
 *
 * A reload runs the same `resolveDocument()` migrate-then-validate path bootstrap uses (#141): a
 * reader on a newer build migrates the writer's older-version document forward, same as
 * bootstrap would; a reader on an older build can't migrate a document from a newer build
 * *forward*, so `resolveDocument()` rejects it (`SchemaVersionTooNewError`) same as an invalid
 * shape would, and this tab keeps showing its last-known-good document rather than an
 * unrecoverable one — with a snackbar telling the user to reload the tab, mirroring
 * `AppUpdateService`'s "reload required" prompt. A rejected `adapter.load()` gets the same
 * treatment: caught, not thrown, same notice.
 */
@Injectable({ providedIn: 'root' })
export class CrossTabSync {
  private readonly persistence = inject(DocumentPersistence);
  private readonly store = inject(DocumentStore);
  private readonly adapter = inject(STORAGE_ADAPTER);
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly snackbar = inject(AppSnackbar);
  private readonly transloco = inject(TranslocoService);
  private readonly createChannel = inject(BROADCAST_CHANNEL_FACTORY);
  private readonly injector = inject(Injector);

  private started = false;
  private isFirstRun = true;
  private reloadNoticeOpen = false;
  private reloadNoticeRef: MatSnackBarRef<TextOnlySnackBar> | null = null;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const channel = this.createChannel(CHANNEL_NAME);
    if (!channel) {
      // No BroadcastChannel support: tabs simply don't cross-notify each other.
      return;
    }

    channel.onmessage = () => {
      if (!this.writerLock.isWriter()) {
        void this.reloadFromAdapter();
      }
    };

    effect(
      () => {
        const savedAt = this.persistence.lastSavedAt();
        if (this.isFirstRun) {
          this.isFirstRun = false;
          return;
        }
        if (savedAt !== null) {
          channel.postMessage({ type: 'saved' });
        }
      },
      { injector: this.injector },
    );
  }

  private async reloadFromAdapter(): Promise<void> {
    let raw: unknown;
    try {
      raw = await this.adapter.load();
    } catch {
      this.notifyReloadBlocked();
      return;
    }
    if (raw === null) {
      return;
    }

    const result = resolveDocument(raw);
    if (!result.ok) {
      this.notifyReloadBlocked();
      return;
    }
    this.store.replaceDocument(result.document);
    // A later broadcast reloaded fine: the tab has self-healed, so a stale "reload this tab"
    // notice from an earlier failure no longer applies and would block a genuinely new one.
    this.reloadNoticeRef?.dismiss();
  }

  private notifyReloadBlocked(): void {
    if (this.reloadNoticeOpen) {
      return;
    }
    this.reloadNoticeOpen = true;
    void this.showReloadNotice();
  }

  private async showReloadNotice(): Promise<void> {
    try {
      const ref = await this.snackbar.open(
        this.transloco.translate('data.crossTab.reloadBlocked'),
        this.transloco.translate('data.snackbar.dismiss'),
      );
      this.reloadNoticeRef = ref;
      ref.afterDismissed().subscribe(() => {
        this.reloadNoticeOpen = false;
        if (this.reloadNoticeRef === ref) {
          this.reloadNoticeRef = null;
        }
      });
    } catch {
      // Couldn't open it (e.g. the snackbar code failed to load): the next failed reload tries again.
      this.reloadNoticeOpen = false;
    }
  }
}
