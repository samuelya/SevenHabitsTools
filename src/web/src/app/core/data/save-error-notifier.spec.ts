import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { FileDownloader } from '../browser/file-download';
import { AppSnackbar } from '../layout/app-snackbar';
import { DocumentPersistence } from './document-persistence';
import { DocumentStore } from './document.store';
import { SaveErrorNotifier } from './save-error-notifier';
import { SaveErrorSnackbar } from './save-error-snackbar';

function setUp(): {
  saveErrorNotifier: SaveErrorNotifier;
  saveError: ReturnType<typeof signal<unknown>>;
  download: ReturnType<typeof vi.fn>;
  openFromComponent: ReturnType<typeof vi.fn>;
  action: Subject<void>;
} {
  const saveError = signal<unknown>(null);
  const download = vi.fn();
  const action = new Subject<void>();
  const openFromComponent = vi.fn().mockResolvedValue({ onAction: () => action });

  TestBed.configureTestingModule({
    providers: [
      {
        provide: DocumentPersistence,
        useValue: { saveError: saveError.asReadonly() } as unknown as DocumentPersistence,
      },
      {
        provide: DocumentStore,
        useValue: { document: () => ({ schemaVersion: 1 }) } as unknown as DocumentStore,
      },
      { provide: FileDownloader, useValue: { download } },
      { provide: AppSnackbar, useValue: { openFromComponent } },
    ],
  });

  return {
    saveErrorNotifier: TestBed.inject(SaveErrorNotifier),
    saveError,
    download,
    openFromComponent,
    action,
  };
}

/** Sets `saveError`, runs effects and waits for the lazily loaded snackbar to open. */
async function reportError(saveError: ReturnType<typeof signal<unknown>>, error: unknown) {
  saveError.set(error);
  TestBed.tick();
  await vi.dynamicImportSettled();
}

describe('SaveErrorNotifier', () => {
  it('does not show a snackbar while there is no save error', async () => {
    const { saveErrorNotifier, openFromComponent } = setUp();

    saveErrorNotifier.start();
    TestBed.tick();
    await vi.dynamicImportSettled();

    expect(openFromComponent).not.toHaveBeenCalled();
  });

  it('opens the save-error snackbar once a save fails', async () => {
    const { saveErrorNotifier, saveError, openFromComponent } = setUp();
    saveErrorNotifier.start();
    TestBed.tick();

    await reportError(saveError, new Error('quota'));

    expect(openFromComponent).toHaveBeenCalledTimes(1);
    const [component, config] = openFromComponent.mock.calls[0]!;
    expect(component).toBe(SaveErrorSnackbar);
    expect(config.data.message).toContain("couldn't save");
    expect(config.data.dismissLabel).toBe('Dismiss');
  });

  it('#128: does not reopen on every retry while saves keep failing, only after a success', async () => {
    const { saveErrorNotifier, saveError, openFromComponent } = setUp();
    saveErrorNotifier.start();
    TestBed.tick();

    await reportError(saveError, new Error('quota 1'));
    await reportError(saveError, new Error('quota 2'));
    expect(openFromComponent).toHaveBeenCalledTimes(1);

    await reportError(saveError, null);
    await reportError(saveError, new Error('quota 3'));
    expect(openFromComponent).toHaveBeenCalledTimes(2);
  });

  it('downloads the current document when "Export now" is used', async () => {
    const { saveErrorNotifier, saveError, download, action } = setUp();
    saveErrorNotifier.start();
    TestBed.tick();
    await reportError(saveError, new Error('quota'));

    action.next();

    expect(download).toHaveBeenCalledWith(
      'seven-habits-tools-backup.json',
      JSON.stringify({ schemaVersion: 1 }, null, 2),
    );
  });

  it('start() is idempotent', async () => {
    const { saveErrorNotifier, saveError, openFromComponent } = setUp();
    saveErrorNotifier.start();
    saveErrorNotifier.start();
    TestBed.tick();

    await reportError(saveError, new Error('quota'));

    expect(openFromComponent).toHaveBeenCalledTimes(1);
  });
});
