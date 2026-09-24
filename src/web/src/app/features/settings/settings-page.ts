import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageStore } from '../../core/i18n/language-store';
import { LANGUAGES, Language, Numerals } from '../../core/i18n/language';
import { intlLocaleFor } from '../../core/i18n/locale.logic';
import { usageMessageFor } from '../../core/data/storage-estimate.utils';
import { StoragePersistenceService } from '../../core/data/storage-persistence.service';
import { BackupSection } from './backup/backup-section';

const NUMERALS: readonly Numerals[] = ['western', 'arabic'];

/** Settings content: the language and numerals preference, the storage persistence/estimate
 * status, the backup (export/import) section, and the privacy note that `/about` links to. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, MatButtonToggleModule, TranslocoPipe, BackupSection],
  template: `
    <h1 class="visually-hidden">{{ 'nav.settings' | transloco }}</h1>
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
      @if (usageMessage(); as usage) {
        <p>{{ usage.key | transloco: usage.params ?? {} }}</p>
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

  constructor() {
    // The estimate `StoragePersistenceService` captured at startup (`requestPersistence()`) is
    // already stale by the time a user opens Settings — refresh it so the usage line reflects
    // what is actually stored now, not the previous page load's figure (#144).
    void this.storagePersistence.refreshEstimate();
  }

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

  protected readonly usageMessage = computed(() => {
    const estimate = this.storagePersistence.estimate();
    if (!estimate) {
      return null;
    }
    const locale = intlLocaleFor(this.languageStore.language(), this.languageStore.numerals());
    return usageMessageFor(estimate.usageBytes, locale);
  });
}
