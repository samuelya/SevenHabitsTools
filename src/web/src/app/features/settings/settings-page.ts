import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Labels } from '../../core/i18n/labels';
import { formatBytes } from '../../core/data/storage-estimate.utils';
import { StoragePersistenceService } from '../../core/data/storage-persistence.service';
import { BackupSection } from './backup/backup-section';

/** Settings placeholder content, the storage persistence/estimate status, the backup (export/
 * import) section, and the privacy note that `/about` links to. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, BackupSection],
  template: `
    <h1 class="page-heading">{{ labels.text('nav.settings') }}</h1>
    <p>{{ labels.text('placeholder.comingSoon') }}</p>
    <section id="storage">
      <h2>{{ labels.text('settings.storage.title') }}</h2>
      <p>{{ labels.text(persistedMessageKey()) }}</p>
      @if (usageText(); as usage) {
        <p>{{ labels.text('settings.storage.usageLabel') }}: {{ usage }}</p>
      }
    </section>
    <app-backup-section />
    <section id="privacy">
      <h2>{{ labels.text('settings.privacyTitle') }}</h2>
      <p>{{ labels.text('settings.privacyNote') }}</p>
    </section>
    <p>
      <a routerLink="/about">{{ labels.text('nav.about') }}</a>
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly labels = inject(Labels);
  private readonly storagePersistence = inject(StoragePersistenceService);

  protected readonly persistedMessageKey = computed(() => {
    switch (this.storagePersistence.persisted()) {
      case true:
        return 'settings.storage.persisted';
      case false:
        return 'settings.storage.notPersisted';
      default:
        return 'settings.storage.unknown';
    }
  });

  protected readonly usageText = computed(() => {
    const estimate = this.storagePersistence.estimate();
    return estimate
      ? `${formatBytes(estimate.usageBytes)} / ${formatBytes(estimate.quotaBytes)}`
      : null;
  });
}
