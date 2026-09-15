import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BackupSettings, registerBackupModel } from '../../core/data/backup/backup.model';
import { DocumentImportExportService } from '../../core/data/backup/document-import-export.service';
import { ExportReminderDismissal } from '../../core/data/backup/export-reminder-dismissal';
import { DocumentMeta } from '../../core/data/document.model';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import {
  ModelRegistration,
  resetRegistryForTesting,
  snapshotRegistryForTesting,
} from '../../core/data/registry';
import { CLOCK } from '../../core/time/clock';
import { HomePage } from './home-page';

const BANNER = 'app-export-reminder-banner';

// Vitest here runs with `isolate: false` (shared module state across spec files): snapshot the
// baseline and register `backup` before each test (`HomePage` calls `featureStore('backup')`
// directly, regardless of `DocumentImportExportService` being faked below), then restore exactly
// that baseline after — not a blind clear, matching `registry.spec.ts`.
let registryBaseline: ReadonlyMap<string, ModelRegistration>;
beforeEach(() => {
  registryBaseline = snapshotRegistryForTesting();
  registerBackupModel();
});
afterEach(() => resetRegistryForTesting(registryBaseline));

function setUp(
  options: {
    meta?: Partial<DocumentMeta>;
    backup?: Partial<BackupSettings>;
    isWriter?: boolean;
    dismissed?: boolean;
    now?: string;
  } = {},
): ComponentFixture<HomePage> {
  const meta: DocumentMeta = {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    appVersion: '0.0.0',
    deviceId: 'd',
    ...options.meta,
  };
  const backup: BackupSettings = { reminderDays: 7, ...options.backup };
  const exportDocument = vi.fn().mockResolvedValue('sevenhabits-2026-01-01.json');

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      // featureStore('backup') and the component's own `select('meta')` both go through this one
      // facade, keyed by path.
      {
        provide: DocumentStore,
        useValue: { select: (path: string) => signal(path === 'meta' ? meta : backup) },
      },
      { provide: WRITER_LOCK, useValue: { isWriter: signal(options.isWriter ?? true) } },
      {
        provide: ExportReminderDismissal,
        useValue: { dismissed: signal(options.dismissed ?? false), dismiss: vi.fn() },
      },
      {
        provide: DocumentImportExportService,
        useValue: { canImport: signal(true), exportDocument },
      },
      {
        provide: CLOCK,
        useValue: { now: () => new Date(options.now ?? '2026-01-01T00:00:00.000Z') },
      },
    ],
  });
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return fixture;
}

describe('HomePage', () => {
  it('does not show the reminder banner when nothing has been edited', () => {
    const fixture = setUp();

    expect(fixture.nativeElement.querySelector(BANNER)).toBeNull();
  });

  it('shows the reminder banner once it is due', () => {
    const fixture = setUp({
      meta: { updatedAt: '2026-01-02T00:00:00.000Z' },
      now: '2026-01-10T00:00:00.000Z', // 7+ days after creation, never exported
    });

    expect(fixture.nativeElement.querySelector(BANNER)).not.toBeNull();
  });

  it('never shows the banner in a read-only tab', () => {
    const fixture = setUp({
      meta: { updatedAt: '2026-01-02T00:00:00.000Z' },
      now: '2026-01-10T00:00:00.000Z',
      isWriter: false,
    });

    expect(fixture.nativeElement.querySelector(BANNER)).toBeNull();
  });

  it('never shows the banner once dismissed today', () => {
    const fixture = setUp({
      meta: { updatedAt: '2026-01-02T00:00:00.000Z' },
      now: '2026-01-10T00:00:00.000Z',
      dismissed: true,
    });

    expect(fixture.nativeElement.querySelector(BANNER)).toBeNull();
  });

  it('dismiss() on the banner calls ExportReminderDismissal.dismiss()', () => {
    const fixture = setUp({
      meta: { updatedAt: '2026-01-02T00:00:00.000Z' },
      now: '2026-01-10T00:00:00.000Z',
    });
    const dismissal = TestBed.inject(ExportReminderDismissal) as unknown as {
      dismiss: ReturnType<typeof vi.fn>;
    };

    fixture.nativeElement
      .querySelectorAll(`${BANNER} button`)[1]
      ?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(dismissal.dismiss).toHaveBeenCalledTimes(1);
  });

  it('exportNow() on the banner calls DocumentImportExportService.exportDocument()', () => {
    const fixture = setUp({
      meta: { updatedAt: '2026-01-02T00:00:00.000Z' },
      now: '2026-01-10T00:00:00.000Z',
    });
    const importExport = TestBed.inject(DocumentImportExportService) as unknown as {
      exportDocument: ReturnType<typeof vi.fn>;
    };

    fixture.nativeElement
      .querySelectorAll(`${BANNER} button`)[0]
      ?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(importExport.exportDocument).toHaveBeenCalledTimes(1);
  });
});
