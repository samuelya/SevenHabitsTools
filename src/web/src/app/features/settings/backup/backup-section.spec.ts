import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppDialog } from '../../../core/layout/app-dialog';
import { AppSnackbar } from '../../../core/layout/app-snackbar';
import { registerBackupModel } from '../../../core/data/backup/backup.model';
import { DocumentImportExportService } from '../../../core/data/backup/document-import-export.service';
import { RootDocument } from '../../../core/data/document.model';
import { DocumentStore } from '../../../core/data/document.store';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { BackupSection, IMPORT_CONFIRM_DIALOG_LOADER } from './backup-section';

// Vitest here runs with `isolate: false` (shared module state across spec files): re-assert the
// `backup` registration before each test (`BackupSection` calls `featureStore('backup')` itself,
// regardless of `DocumentImportExportService` being faked below). A permanent, real registration
// — like `pwa`'s own bare `registerModel()` call, not a test-only fixture — so this deliberately
// never restores the registry to a prior snapshot afterward (see `backup.model.spec.ts`).
beforeEach(() => registerBackupModel());

function text(fixture: ComponentFixture<BackupSection>, selector: string): string {
  return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? '';
}

function buttons(fixture: ComponentFixture<BackupSection>): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll('button')];
}

function setUp(
  options: {
    canImport?: boolean;
    canShare?: boolean;
    parseImportFile?: ReturnType<typeof vi.fn>;
    dialogResult?: string | undefined;
    replaceWithImportResult?: boolean;
    shareDocumentResult?: boolean;
    dialogOpen?: ReturnType<typeof vi.fn>;
    dialogLoader?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const exportDocument = vi.fn().mockResolvedValue('sevenhabits-2026-02-01.json');
  const shareDocument = vi.fn().mockResolvedValue(options.shareDocumentResult ?? true);
  const parseImportFile =
    options.parseImportFile ??
    vi.fn().mockReturnValue({
      ok: true,
      document: { meta: { updatedAt: 'imported' } } as unknown as RootDocument,
      preview: { updatedAt: 'imported', counts: [] },
    });
  const replaceWithImport = vi.fn().mockResolvedValue(options.replaceWithImportResult ?? true);
  const snackbarOpen = vi.fn().mockResolvedValue(undefined);
  const dialogOpen =
    options.dialogOpen ??
    vi.fn().mockResolvedValue({ afterClosed: () => of(options.dialogResult) });

  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      {
        provide: DocumentImportExportService,
        useValue: {
          canImport: signal(options.canImport ?? true),
          canShare: options.canShare ?? false,
          exportDocument,
          shareDocument,
          parseImportFile,
          replaceWithImport,
        },
      },
      { provide: AppSnackbar, useValue: { open: snackbarOpen } },
      { provide: AppDialog, useValue: { open: dialogOpen } },
      {
        provide: DocumentStore,
        useValue: { select: () => signal({ updatedAt: '2026-01-01T00:00:00.000Z' }) },
      },
      ...(options.dialogLoader
        ? [{ provide: IMPORT_CONFIRM_DIALOG_LOADER, useValue: options.dialogLoader }]
        : []),
    ],
  });
  const fixture = TestBed.createComponent(BackupSection);
  fixture.detectChanges();
  return {
    fixture,
    exportDocument,
    shareDocument,
    parseImportFile,
    replaceWithImport,
    snackbarOpen,
    dialogOpen,
  };
}

function fileInput(fixture: ComponentFixture<BackupSection>): HTMLInputElement {
  return fixture.nativeElement.querySelector('input[type="file"]');
}

/** Drains both the dynamic `import('./import-confirm-dialog')` this component triggers and the
 * plain promise chain after it (`file.text()`, the mocked service/dialog calls), since this suite
 * has no fake timers to advance instead. */
async function flush(): Promise<void> {
  await vi.dynamicImportSettled();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('BackupSection', () => {
  it('exports and shows a confirmation snackbar', async () => {
    const { fixture, exportDocument, snackbarOpen } = setUp();

    buttons(fixture)
      .find((b) => b.textContent?.includes('Export data'))
      ?.click();
    await flush();
    fixture.detectChanges();

    expect(exportDocument).toHaveBeenCalledTimes(1);
    expect(snackbarOpen).toHaveBeenCalledWith(
      expect.stringContaining('sevenhabits-2026-02-01.json'),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('#154: hides Share… when the service reports no Web Share capability', () => {
    const { fixture } = setUp({ canShare: false });

    expect(buttons(fixture).some((b) => b.textContent?.includes('Share'))).toBe(false);
  });

  it('#154: Share… shares (never downloads) when the Web Share API can', async () => {
    const { fixture, shareDocument, exportDocument, snackbarOpen } = setUp({ canShare: true });

    buttons(fixture)
      .find((b) => b.textContent?.includes('Share'))
      ?.click();
    await flush();
    fixture.detectChanges();

    expect(shareDocument).toHaveBeenCalledTimes(1);
    expect(exportDocument).not.toHaveBeenCalled();
    expect(snackbarOpen).toHaveBeenCalledWith(
      expect.stringContaining('Shared'),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('#154: Share… stays silent (no snackbar, no download fallback) when the user cancels the share sheet', async () => {
    const { fixture, exportDocument, snackbarOpen } = setUp({
      canShare: true,
      shareDocumentResult: false,
    });

    buttons(fixture)
      .find((b) => b.textContent?.includes('Share'))
      ?.click();
    await flush();
    fixture.detectChanges();

    expect(exportDocument).not.toHaveBeenCalled();
    expect(snackbarOpen).not.toHaveBeenCalled();
  });

  it('refuses to import on a read-only tab, with the read-only message, and never opens the file picker', () => {
    const { fixture, snackbarOpen } = setUp({ canImport: false });
    const clickSpy = vi.spyOn(fileInput(fixture), 'click');

    buttons(fixture)
      .find((b) => b.textContent?.includes('Import data'))
      ?.click();

    expect(clickSpy).not.toHaveBeenCalled();
    expect(snackbarOpen).toHaveBeenCalledWith(
      expect.stringContaining('read-only'),
      expect.any(String),
    );
  });

  it('opens the file picker when this tab may import', () => {
    const { fixture } = setUp({ canImport: true });
    const clickSpy = vi.spyOn(fileInput(fixture), 'click');

    buttons(fixture)
      .find((b) => b.textContent?.includes('Import data'))
      ?.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a translated error and never opens the confirm dialog for an invalid file', async () => {
    const parseImportFile = vi
      .fn()
      .mockReturnValue({ ok: false, messageKey: 'data.import.errors.notJson' });
    const { fixture, dialogOpen } = setUp({ parseImportFile });
    const input = fileInput(fixture);
    Object.defineProperty(input, 'files', {
      value: [new File(['not json'], 'bad.json', { type: 'application/json' })],
    });

    input.dispatchEvent(new Event('change'));
    await flush();
    fixture.detectChanges();

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(text(fixture, '.backup-section__error')).toContain("isn't a JSON file");
  });

  it('opens the confirm dialog and replaces the document on "replace"', async () => {
    const { fixture, dialogOpen, replaceWithImport } = setUp({ dialogResult: 'replace' });
    const input = fileInput(fixture);
    Object.defineProperty(input, 'files', {
      value: [new File(['{}'], 'good.json', { type: 'application/json' })],
    });

    input.dispatchEvent(new Event('change'));
    await flush();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(replaceWithImport).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the dialog is cancelled', async () => {
    const { fixture, replaceWithImport } = setUp({ dialogResult: undefined });
    const input = fileInput(fixture);
    Object.defineProperty(input, 'files', {
      value: [new File(['{}'], 'good.json', { type: 'application/json' })],
    });

    input.dispatchEvent(new Event('change'));
    await flush();

    expect(replaceWithImport).not.toHaveBeenCalled();
  });

  it('shows an error, without opening the dialog, when the lazy import dialog chunk fails to load (offline)', async () => {
    const dialogOpen = vi.fn();
    const dialogLoader = vi.fn().mockRejectedValue(new Error('chunk load failed'));
    const { fixture } = setUp({ dialogOpen, dialogLoader });
    const input = fileInput(fixture);
    Object.defineProperty(input, 'files', {
      value: [new File(['{}'], 'good.json', { type: 'application/json' })],
    });

    input.dispatchEvent(new Event('change'));
    await flush();
    fixture.detectChanges();

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(text(fixture, '.backup-section__error')).toContain("Couldn't load the import dialog");
  });

  it('#155: refuses a file dropped straight into the input without going through the Import button, on a read-only tab', async () => {
    const { fixture, parseImportFile, dialogOpen, snackbarOpen } = setUp({ canImport: false });
    const input = fileInput(fixture);
    Object.defineProperty(input, 'files', {
      value: [new File(['{}'], 'good.json', { type: 'application/json' })],
    });

    input.dispatchEvent(new Event('change'));
    await flush();

    expect(parseImportFile).not.toHaveBeenCalled();
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(snackbarOpen).toHaveBeenCalledWith(
      expect.stringContaining('read-only'),
      expect.any(String),
    );
  });

  it('#155: shows the read-only message, not "Import complete.", when replaceWithImport was refused', async () => {
    // Simulates this tab losing the writer lock between opening the dialog and choosing Replace:
    // the service's own canImport() gate refuses the actual replace, returning false.
    const { fixture, replaceWithImport, snackbarOpen } = setUp({
      dialogResult: 'replace',
      replaceWithImportResult: false,
    });
    const input = fileInput(fixture);
    Object.defineProperty(input, 'files', {
      value: [new File(['{}'], 'good.json', { type: 'application/json' })],
    });

    input.dispatchEvent(new Event('change'));
    await flush();

    expect(replaceWithImport).toHaveBeenCalledTimes(1);
    expect(snackbarOpen).not.toHaveBeenCalledWith(
      expect.stringContaining('Import complete'),
      expect.any(String),
      expect.any(Object),
    );
    expect(snackbarOpen).toHaveBeenCalledWith(
      expect.stringContaining('read-only'),
      expect.any(String),
    );
  });
});
