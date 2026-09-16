import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BACKUP_MODEL_KEY, BackupSettings } from '../../core/data/backup/backup.model';
import { DocumentImportExportService } from '../../core/data/backup/document-import-export.service';
import { ExportReminderDismissal } from '../../core/data/backup/export-reminder-dismissal';
import { shouldShowExportReminder } from '../../core/data/backup/export-reminder.logic';
import { DocumentMeta } from '../../core/data/document.model';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import { ExportReminderBanner } from '../../shared/ui/export-reminder-banner/export-reminder-banner';

@Component({
  selector: 'app-home-page',
  imports: [MatButtonModule, RouterLink, ExportReminderBanner, TranslocoPipe],
  template: `
    @if (showExportReminder()) {
      <app-export-reminder-banner
        [message]="'data.export.reminder' | transloco"
        [exportLabel]="'data.export.action' | transloco"
        [dismissLabel]="'data.snackbar.dismiss' | transloco"
        (exportNow)="exportNow()"
        (dismiss)="dismissReminder()"
      />
    }
    <h1 class="page-heading">{{ 'app.name' | transloco }}</h1>
    <p>{{ 'home.welcome' | transloco }}</p>
    <a mat-flat-button routerLink="/habits">{{ 'home.browseHabits' | transloco }}</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly meta = inject(DocumentStore).select<DocumentMeta>('meta');
  private readonly backup = featureStore<BackupSettings>(BACKUP_MODEL_KEY);
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly dismissal = inject(ExportReminderDismissal);
  private readonly importExport = inject(DocumentImportExportService);
  private readonly clock = inject(CLOCK);

  // `now` is read once per computation, not on a timer: a banner that becomes due while the user
  // is already on this page can wait for the next edit, dismissal or navigation back here to
  // reconsider it, rather than this page polling the clock.
  protected readonly showExportReminder = computed(() =>
    shouldShowExportReminder({
      documentCreatedAt: this.meta()?.createdAt ?? '',
      documentUpdatedAt: this.meta()?.updatedAt ?? '',
      lastExportedAt: this.backup.value().lastExportedAt,
      lastExportedDocumentUpdatedAt: this.backup.value().lastExportedDocumentUpdatedAt,
      reminderDays: this.backup.value().reminderDays,
      now: this.clock.now(),
      dismissedToday: this.dismissal.dismissed(),
      isWriter: this.writerLock.isWriter(),
    }),
  );

  protected exportNow(): void {
    void this.importExport.exportDocument();
  }

  protected dismissReminder(): void {
    this.dismissal.dismiss();
  }
}
