import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { registerBackupModel } from '../../core/data/backup/backup.model';
import { NoopAdapter } from '../../core/data/noop-storage-adapter';
import {
  StorageEstimateInfo,
  StoragePersistenceService,
} from '../../core/data/storage-persistence.service';
import { STORAGE_ADAPTER } from '../../core/data/storage-adapter';
import { SettingsPage } from './settings-page';

// Vitest here runs with `isolate: false` (shared module state across spec files): re-assert the
// `backup` registration before each test (the embedded `BackupSection` calls
// `featureStore('backup')`). A permanent, real registration — like `pwa`'s own bare
// `registerModel()` call, not a test-only fixture — so this deliberately never restores the
// registry to a prior snapshot afterward (see `backup.model.spec.ts`).
beforeEach(() => registerBackupModel());

function text(fixture: { nativeElement: HTMLElement }, selector: string): string {
  return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? '';
}

function setUp(persisted: boolean | null, estimate: StorageEstimateInfo | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      // BackupSection (embedded below) resolves DocumentImportExportService, which needs a
      // STORAGE_ADAPTER (the one token in that chain with no safe default) even though this suite
      // never exercises export/import itself.
      { provide: STORAGE_ADAPTER, useClass: NoopAdapter },
      {
        provide: StoragePersistenceService,
        useValue: { persisted: signal(persisted), estimate: signal(estimate) },
      },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  return fixture;
}

describe('SettingsPage', () => {
  it('shows the "protected" message and the usage estimate when persisted', () => {
    const fixture = setUp(true, { usageBytes: 1024 * 1024, quotaBytes: 100 * 1024 * 1024 });

    expect(text(fixture, '#storage')).toContain('protected from automatic clearing');
    expect(text(fixture, '#storage')).toContain('1.0 MB / 100.0 MB');
  });

  it('shows the "may be cleared" message when not persisted', () => {
    const fixture = setUp(false, null);

    expect(text(fixture, '#storage')).toContain('may clear this data');
  });

  it('shows the "not available" message when the Storage Manager API is unsupported', () => {
    const fixture = setUp(null, null);

    expect(text(fixture, '#storage')).toContain('not available in this browser');
  });

  it('does not show a usage line when there is no estimate yet', () => {
    const fixture = setUp(null, null);

    expect(text(fixture, '#storage')).not.toContain('Used');
  });

  it('still shows the privacy note', () => {
    const fixture = setUp(null, null);

    expect(text(fixture, '#privacy')).toContain('Your data stays in this browser');
  });
});
