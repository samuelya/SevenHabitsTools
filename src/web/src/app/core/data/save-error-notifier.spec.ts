import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FileDownloader } from '../browser/file-download';
import { DocumentPersistence } from './document-persistence';
import { DocumentStore } from './document.store';
import { SaveErrorNotifier } from './save-error-notifier';

function setUp(): {
  saveErrorNotifier: SaveErrorNotifier;
  saveError: ReturnType<typeof signal<unknown>>;
  download: ReturnType<typeof vi.fn>;
} {
  const saveError = signal<unknown>(null);
  const download = vi.fn();

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
    ],
  });

  return { saveErrorNotifier: TestBed.inject(SaveErrorNotifier), saveError, download };
}

describe('SaveErrorNotifier', () => {
  it('does not show a snackbar while there is no save error', () => {
    const { saveErrorNotifier } = setUp();
    const openSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    saveErrorNotifier.start();
    TestBed.tick();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens a snackbar once a save fails', () => {
    const { saveErrorNotifier, saveError } = setUp();
    const openSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    saveErrorNotifier.start();
    TestBed.tick();
    saveError.set(new Error('quota'));
    TestBed.tick();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0]![0]).toContain("couldn't save");
  });

  it('downloads the current document when the snackbar action is used', () => {
    const { saveErrorNotifier, saveError, download } = setUp();
    saveErrorNotifier.start();
    TestBed.tick();

    saveError.set(new Error('quota'));
    TestBed.tick();
    const snackBarRef = TestBed.inject(MatSnackBar)._openedSnackBarRef;
    snackBarRef?.dismissWithAction();

    expect(download).toHaveBeenCalledWith(
      'seven-habits-tools-backup.json',
      JSON.stringify({ schemaVersion: 1 }, null, 2),
    );
  });

  it('start() is idempotent', () => {
    const { saveErrorNotifier, saveError } = setUp();
    const openSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    saveErrorNotifier.start();
    saveErrorNotifier.start();
    TestBed.tick();

    saveError.set(new Error('quota'));
    TestBed.tick();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
