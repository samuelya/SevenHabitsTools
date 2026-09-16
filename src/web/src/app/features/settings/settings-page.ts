import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageStore } from '../../core/i18n/language-store';
import { LANGUAGES, Language, Numerals } from '../../core/i18n/language';
import { AppNumberPipe } from '../../core/i18n/locale.pipe';
import { fractionOptionsFor, toByteSize } from '../../core/data/storage-estimate.utils';
import { StoragePersistenceService } from '../../core/data/storage-persistence.service';
import { BackupSection } from './backup/backup-section';

const NUMERALS: readonly Numerals[] = ['western', 'arabic'];

/** Settings content: the language and numerals preference, the storage persistence/estimate
 * status, the backup (export/import) section, and the privacy note that `/about` links to. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, MatButtonToggleModule, TranslocoPipe, AppNumberPipe, BackupSection],
  template: `
    <h1 class="page-heading">{{ 'nav.settings' | transloco }}</h1>
    <section id="language">
      <h2>{{ 'language.label' | transloco }}</h2>
      <mat-button-toggle-group
        [value]="languageStore.language()"
        [attr.aria-label]="'language.label' | transloco"
        (change)="languageStore.setLanguage($event.value)"
      >
        @for (language of languages; track language) {
          <mat-button-toggle [value]="language">{{
            'language.' + language | transloco
          }}</mat-button-toggle>
        }
      </mat-button-toggle-group>

      <h2>{{ 'language.numeralsLabel' | transloco }}</h2>
      <mat-button-toggle-group
        [value]="languageStore.numerals()"
        [attr.aria-label]="'language.numeralsLabel' | transloco"
        (change)="languageStore.setNumerals($event.value)"
      >
        @for (numerals of numeralsOptions; track numerals) {
          <mat-button-toggle [value]="numerals">{{
            numeralsKey(numerals) | transloco
          }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
    </section>
    <section id="storage">
      <h2>{{ 'settings.storage.title' | transloco }}</h2>
      <p>{{ persistedMessageKey() | transloco }}</p>
      @if (usage(); as usage) {
        <p>
          {{ 'settings.storage.usageLabel' | transloco }}:
          {{ usage.used.value | appNumber: fractionOptionsFor(usage.used) }} {{ usage.used.unit }} /
          {{ usage.quota.value | appNumber: fractionOptionsFor(usage.quota) }}
          {{ usage.quota.unit }}
        </p>
      }
    </section>
    <app-backup-section />
    <section id="privacy">
      <h2>{{ 'settings.privacyTitle' | transloco }}</h2>
      <p>{{ 'settings.privacyNote' | transloco }}</p>
    </section>
    <p>
      <a routerLink="/about">{{ 'nav.about' | transloco }}</a>
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly languageStore = inject(LanguageStore);
  private readonly storagePersistence = inject(StoragePersistenceService);

  protected readonly languages: readonly Language[] = LANGUAGES;
  protected readonly numeralsOptions = NUMERALS;

  protected numeralsKey(numerals: Numerals): string {
    return numerals === 'western' ? 'language.numeralsWestern' : 'language.numeralsArabic';
  }

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

  protected readonly usage = computed(() => {
    const estimate = this.storagePersistence.estimate();
    return estimate
      ? { used: toByteSize(estimate.usageBytes), quota: toByteSize(estimate.quotaBytes) }
      : null;
  });

  /** Exposed for the template — Angular templates can only call component members, not free
   * functions, even when imported. */
  protected readonly fractionOptionsFor = fractionOptionsFor;
}
