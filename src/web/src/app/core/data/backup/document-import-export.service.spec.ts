import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BROADCAST_CHANNEL_FACTORY } from '../../browser/broadcast-channel';
import { FileDownloader } from '../../browser/file-download';
import { WEB_SHARE } from '../../browser/web-share';
import { CLOCK } from '../../time/clock';
import { DocumentBootstrapStatus } from '../document-bootstrap-status';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { WriterLockService } from '../multi-tab/writer-lock.service';
import { WRITER_LOCK } from '../multi-tab/writer-lock';
import { STORAGE_ADAPTER, StorageAdapter } from '../storage-adapter';
import { registerBackupModel } from './backup.model';
import { DocumentImportExportService } from './document-import-export.service';
import { CURRENT_SCHEMA_VERSION } from '../document.model';

// Vitest here runs with `isolate: false` (shared module state across spec files): re-assert the
// `backup` registration before each test (another spec's `resetRegistryForTesting()` may have
// cleared it). A permanent, real registration — like `pwa`'s own bare `registerModel()` call, not
// a test-only fixture — so this deliberately never restores the registry to a prior snapshot
// afterward (see `backup.model.spec.ts`).
beforeEach(() => registerBackupModel());

function validDoc(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { createdAt: 't1', updatedAt: 't2', appVersion: '0.0.0', deviceId: 'imported-device' },
    profile: {},
    settings: {},
    shared: {},
    habits: {},
    extras: {},
    ...overrides,
  };
}

function setUp(options: { isWriter?: boolean } = {}) {
  const save = vi.fn().mockResolvedValue(undefined);
  const adapter: StorageAdapter = {
    kind: 'noop',
    load: vi.fn().mockResolvedValue(null),
    save: save as unknown as StorageAdapter['save'],
    clear: vi.fn().mockResolvedValue(undefined),
  };
  const download = vi.fn();
  // `documentSync.start()` (the corrupt-recovery path, #150) starts the real `WriterLockService`
  // unless it's faked here — a fake keeps this suite from touching a real BroadcastChannel or
  // leaving a heartbeat interval running, matching `data-error-page.spec.ts`'s own reset() test.
  // `WRITER_LOCK` is bound with `useExisting`, exactly like `app.config.ts`, so `canImport()`
  // (`DocumentImportExportService`) and the writer-lock gate inside `DocumentPersistence` both
  // read the *same* signal this fake's `start()` updates — the corrupt-recovery test below needs
  // that: `isWriter` starts `false` (the real pre-start state) and only becomes `true` once
  // `WriterLockService.start()` actually runs, simulating `WebLocksWriterLock`'s uncontended
  // `ifAvailable: true` fast grant (there is no other writer to contend with right after
  // recovering from corrupt).
  const isWriterSignal = signal(options.isWriter ?? true);
  const writerLockServiceStart = vi.fn(() => isWriterSignal.set(true));
  TestBed.configureTestingModule({
    providers: [
      { provide: STORAGE_ADAPTER, useValue: adapter },
      { provide: FileDownloader, useValue: { download } },
      { provide: WEB_SHARE, useValue: null },
      { provide: CLOCK, useValue: { now: () => new Date('2026-02-01T00:00:00.000Z') } },
      { provide: WRITER_LOCK, useExisting: WriterLockService },
      { provide: BROADCAST_CHANNEL_FACTORY, useValue: () => null },
      {
        provide: WriterLockService,
        useValue: {
          start: writerLockServiceStart,
          stop: vi.fn(),
          role: signal('writer'),
          isWriter: isWriterSignal,
          promoted: signal(false),
        },
      },
    ],
  });
  return {
    service: TestBed.inject(DocumentImportExportService),
    store: TestBed.inject(DocumentStore),
    persistence: TestBed.inject(DocumentPersistence),
    bootstrapStatus: TestBed.inject(DocumentBootstrapStatus),
    save,
    download,
    writerLockServiceStart,
  };
}

describe('DocumentImportExportService', () => {
  describe('exportDocument', () => {
    it('downloads the document as pretty-printed JSON with meta.exportedAt set', async () => {
      const { service, download } = setUp();

      const filename = await service.exportDocument();

      expect(filename).toBe('sevenhabits-2026-02-01.json');
      expect(download).toHaveBeenCalledTimes(1);
      const [downloadedName, content] = download.mock.calls[0];
      expect(downloadedName).toBe(filename);
      const parsed = JSON.parse(content);
      expect(parsed.meta.exportedAt).toBe('2026-02-01T00:00:00.000Z');
      expect(content).toContain('\n'); // pretty-printed, not a single line
    });

    it("records settings.backup.lastExportedAt as the exported snapshot's own meta.updatedAt", async () => {
      const { service, store } = setUp();
      const exportedAsOf = store.document().meta.updatedAt;

      await service.exportDocument();

      expect(
        (store.document().settings as { backup: { lastExportedAt: string } }).backup.lastExportedAt,
      ).toBe(exportedAsOf);
    });

    it('#152 regression: never bumps meta.updatedAt beyond lastExportedAt, or the reminder would immediately re-arm', async () => {
      const { service, store } = setUp();

      await service.exportDocument();

      const document = store.document();
      const lastExportedAt = (document.settings as { backup: { lastExportedAt: string } }).backup
        .lastExportedAt;
      expect(document.meta.updatedAt).toBe(lastExportedAt);
    });

    it('does not clobber a concurrent edit made while downloading was in flight', async () => {
      const ref: { store?: DocumentStore } = {};
      const download = vi.fn().mockImplementation(() => {
        // A "concurrent" edit: store.document() changes mid-export, before lastExportedAt is
        // recorded.
        ref.store?.update('settings', () => ({ editedDuringExport: true }));
      });
      TestBed.overrideProvider(FileDownloader, { useValue: { download } });
      const setup = setUp();
      ref.store = setup.store;

      await setup.service.exportDocument();

      expect(
        (ref.store.document().settings as { editedDuringExport?: boolean }).editedDuringExport,
      ).toBe(true);
    });

    it('#154 regression: always downloads, even when the Web Share API is available', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      TestBed.overrideProvider(WEB_SHARE, {
        useValue: { canShareFiles: () => true, share },
      });
      const { service, download } = setUp();

      await service.exportDocument();

      expect(download).toHaveBeenCalledTimes(1);
      expect(share).not.toHaveBeenCalled();
    });
  });

  describe('shareDocument', () => {
    it('shares the document and records lastExportedAt', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      TestBed.overrideProvider(WEB_SHARE, { useValue: { canShareFiles: () => true, share } });
      const { service, store, download } = setUp();

      const shared = await service.shareDocument();

      expect(shared).toBe(true);
      expect(share).toHaveBeenCalledTimes(1);
      expect(download).not.toHaveBeenCalled();
      expect(
        (store.document().settings as { backup: { lastExportedAt: string } }).backup.lastExportedAt,
      ).toBeTruthy();
    });

    it('returns false, downloading and recording nothing, when there is no Web Share capability', async () => {
      const { service, store, download } = setUp();
      const before = store.document();

      const shared = await service.shareDocument();

      expect(shared).toBe(false);
      expect(download).not.toHaveBeenCalled();
      expect(store.document()).toBe(before);
    });

    it('returns false when navigator.canShare() declines this file, without downloading it instead', async () => {
      const share = vi.fn();
      TestBed.overrideProvider(WEB_SHARE, {
        useValue: { canShareFiles: () => false, share },
      });
      const { service, download } = setUp();

      const shared = await service.shareDocument();

      expect(shared).toBe(false);
      expect(share).not.toHaveBeenCalled();
      expect(download).not.toHaveBeenCalled();
    });

    it('returns false, and records nothing, when the user cancels the share sheet', async () => {
      const share = vi.fn().mockRejectedValue(new Error('cancelled'));
      TestBed.overrideProvider(WEB_SHARE, { useValue: { canShareFiles: () => true, share } });
      const { service, store } = setUp();
      const before = store.document();

      const shared = await service.shareDocument();

      expect(shared).toBe(false);
      expect(store.document()).toBe(before);
    });
  });

  describe('parseImportFile', () => {
    it('rejects text that is not JSON', () => {
      const { service } = setUp();

      expect(service.parseImportFile('not json')).toEqual({
        ok: false,
        messageKey: 'data.import.errors.notJson',
      });
    });

    it('rejects a document from a newer schema version, with the migration message key', () => {
      const { service } = setUp();

      const result = service.parseImportFile(
        JSON.stringify(validDoc({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })),
      );

      expect(result).toEqual({ ok: false, messageKey: 'data.migration.schemaTooNew' });
    });

    it('rejects a structurally invalid document', () => {
      const { service } = setUp();

      const result = service.parseImportFile(
        JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION }),
      );

      expect(result).toEqual({ ok: false, messageKey: 'data.import.errors.invalid' });
    });

    it('accepts a valid document and builds its preview', () => {
      const { service } = setUp();

      const result = service.parseImportFile(JSON.stringify(validDoc()));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.document.meta.deviceId).toBe('imported-device');
        expect(result.preview.updatedAt).toBe('t2');
      }
    });
  });

  describe('replaceWithImport', () => {
    it('replaces the document and saves it immediately', async () => {
      const { service, store, save } = setUp();
      const imported = validDoc({ settings: { theme: 'dark' } });

      const applied = await service.replaceWithImport(imported as never);

      expect(applied).toBe(true);
      expect(store.document()).toEqual(imported);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('refuses on a read-only tab, leaving the document untouched', async () => {
      const { service, store, save } = setUp({ isWriter: false });
      const before = store.document();

      const applied = await service.replaceWithImport(validDoc() as never);

      expect(applied).toBe(false);
      expect(store.document()).toBe(before);
      expect(save).not.toHaveBeenCalled();
    });

    it('#37/#150 regression: recovers from a corrupt bootstrap the same way DataErrorPage.reset() does, even though this tab is not (yet) the writer', async () => {
      // isWriter: false is the real pre-recovery state: the writer lock has never started while
      // corrupt (`app.config.ts` only starts `DocumentSync` once bootstrap is `ready`), so
      // `canImport` would normally be false here. #150: gating the corrupt-recovery import on it
      // made the recovery path unreachable — this proves it is not gated on it.
      const { service, store, bootstrapStatus, save, persistence, writerLockServiceStart } = setUp({
        isWriter: false,
      });
      bootstrapStatus.reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
      expect(persistence.dirty()).toBe(false);

      const imported = validDoc({ settings: { recovered: true } });
      const applied = await service.replaceWithImport(imported as never);

      expect(applied).toBe(true);
      expect(bootstrapStatus.state()).toBe('ready');
      expect(store.document()).toEqual(imported);
      // DocumentSync was never started while corrupt; this must start it — not just leave the
      // imported document held in memory, unsaved and with no writer lock. Asserted on the real
      // WriterLockService directly (not just the `save` call below), since the mock-only save
      // path was satisfied by `saveNow()` alone even with `documentSync.start()` deleted (the
      // exact gap tester-37 found by mutation testing).
      expect(writerLockServiceStart).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][0]).toEqual(imported);
    });
  });
});
