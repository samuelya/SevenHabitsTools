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
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import './settings.model';
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
  const refreshEstimate = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter([]),
      // BackupSection (embedded below) resolves DocumentImportExportService, which needs a
      // STORAGE_ADAPTER (the one token in that chain with no safe default) even though this suite
      // never exercises export/import itself.
      { provide: STORAGE_ADAPTER, useClass: NoopAdapter },
      {
        provide: StoragePersistenceService,
        useValue: { persisted: signal(persisted), estimate: signal(estimate), refreshEstimate },
      },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  return { fixture, refreshEstimate };
}

describe('SettingsPage', () => {
  it('shows the "protected" message and a friendly usage estimate when persisted', () => {
    const { fixture } = setUp(true, { usageBytes: 1024 * 1024, quotaBytes: 100 * 1024 * 1024 });

    expect(text(fixture, '#storage')).toContain("won't clear this data on its own");
    expect(text(fixture, '#storage')).toContain('using about 1.0 MB in this browser');
    // The quota is the browser's per-origin allowance, not the app's usage — never shown as
    // "used / quota" (#144).
    expect(text(fixture, '#storage')).not.toMatch(/\d+(\.\d+)? ?[KMGT]?B \//);
  });

  it('collapses a usage under 1 KB to a friendly message instead of a raw byte count', () => {
    const { fixture } = setUp(true, { usageBytes: 25, quotaBytes: 100 * 1024 * 1024 });

    expect(text(fixture, '#storage')).toContain('using less than 1 KB in this browser');
    expect(text(fixture, '#storage')).not.toContain('25');
  });

  it('shows the "may be cleared" message when not persisted', () => {
    const { fixture } = setUp(false, null);

    expect(text(fixture, '#storage')).toContain('may clear this data');
  });

  it('shows the "not available" message when the Storage Manager API is unsupported', () => {
    const { fixture } = setUp(null, null);

    expect(text(fixture, '#storage')).toContain("doesn't say whether");
  });

  it('does not show a usage line when there is no estimate yet', () => {
    const { fixture } = setUp(null, null);

    expect(text(fixture, '#storage')).not.toContain('using');
  });

  it('refreshes the storage estimate on open, not just at startup', () => {
    const { refreshEstimate } = setUp(true, null);

    expect(refreshEstimate).toHaveBeenCalledTimes(1);
  });

  it('still shows the privacy note', () => {
    const { fixture } = setUp(null, null);

    expect(text(fixture, '#privacy')).toContain('Your data stays in this browser');
  });
});
