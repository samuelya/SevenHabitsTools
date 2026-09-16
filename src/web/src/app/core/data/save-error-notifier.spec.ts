import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { FileDownloader } from '../browser/file-download';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { AppSnackbar } from '../layout/app-snackbar';
import { DocumentPersistence } from './document-persistence';
import { DocumentStore } from './document.store';
import { SaveErrorNotifier } from './save-error-notifier';
import { SaveErrorSnackbar } from './save-error-snackbar';

interface FakeRef {
  readonly action: Subject<void>;
  readonly dismissed: Subject<void>;
  readonly dismiss: ReturnType<typeof vi.fn>;
}

function setUp() {
  const saveError = signal<unknown>(null);
  const document = signal<object>({ schemaVersion: 1, v: 'initial' });
  const download = vi.fn();
  const refs: FakeRef[] = [];
  const openFromComponent = vi.fn(async () => {
    const dismissed = new Subject<void>();
    const ref: FakeRef = {
      action: new Subject<void>(),
      dismissed,
      // Real `MatSnackBarRef.dismiss()` starts an exit animation; `afterDismissed` only emits once
      // it completes, which can be well after `dismiss()` returns (see the #142 race regression
      // test below) — so this fake does not couple the two synchronously either.
      dismiss: vi.fn(),
    };
    refs.push(ref);
    return {
      onAction: () => ref.action,
      afterDismissed: () => ref.dismissed,
      dismiss: ref.dismiss,
    };
  });

  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      {
        provide: DocumentPersistence,
        useValue: { saveError: saveError.asReadonly() } as unknown as DocumentPersistence,
      },
      { provide: DocumentStore, useValue: { document } as unknown as DocumentStore },
      { provide: FileDownloader, useValue: { download } },
      { provide: AppSnackbar, useValue: { openFromComponent, preload: vi.fn() } },
    ],
  });

  const notifier = TestBed.inject(SaveErrorNotifier);
  notifier.start();
  TestBed.tick();

  /** A save attempt failed (each attempt reports a new error object). */
  const failSave = async (): Promise<void> => {
    saveError.set(new Error('quota'));
    TestBed.tick();
    await vi.dynamicImportSettled();
  };
  const succeedSave = (): void => {
    saveError.set(null);
    TestBed.tick();
  };
  /** Closes the most recent snackbar, the way Dismiss (or Export now) does. */
  const close = (): void => {
    refs.at(-1)!.dismissed.next();
  };
  const edit = (v: string): void => document.set({ schemaVersion: 1, v });

  return { notifier, download, openFromComponent, refs, failSave, succeedSave, close, edit };
}

describe('SaveErrorNotifier', () => {
  it('does not show a snackbar while there is no save error', async () => {
    const { openFromComponent } = setUp();
    await vi.dynamicImportSettled();

    expect(openFromComponent).not.toHaveBeenCalled();
  });

  it('preloads the snackbar code when it starts', () => {
    setUp();

    expect(TestBed.inject(AppSnackbar).preload).toHaveBeenCalled();
  });

  it('opens the save-error snackbar once a save fails', async () => {
    const { failSave, openFromComponent } = setUp();

    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(1);
    const [component, config] = openFromComponent.mock.calls[0]! as unknown as [
      unknown,
      { data: { message: string; dismissLabel: string } },
    ];
    expect(component).toBe(SaveErrorSnackbar);
    expect(config.data.message).toContain("couldn't save");
    expect(config.data.dismissLabel).toBe('Dismiss');
  });

  it('#128: neither stacks nor reopens for retries of the same unsaved document', async () => {
    const { failSave, close, openFromComponent } = setUp();

    await failSave();
    await failSave(); // retry while it is still open
    close();
    await failSave(); // retry after it was closed, nothing new to save
    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(1);
  });

  it('#139: stays quiet once suppressed, so it cannot replace the reload prompt', async () => {
    const { notifier, failSave, edit, openFromComponent } = setUp();

    notifier.suppress();
    await failSave();
    edit('edit-after-suppress');
    await failSave();

    expect(openFromComponent).not.toHaveBeenCalled();
  });

  it('#136: reopens when edits made after Dismiss also fail to save', async () => {
    const { failSave, close, edit, openFromComponent } = setUp();
    await failSave();
    close();

    edit('edit-2-after-dismiss');
    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(2);
  });

  it('#136: reopens when edits made after Export now also fail to save', async () => {
    const { failSave, refs, close, edit, download, openFromComponent } = setUp();
    await failSave();
    refs[0]!.action.next();
    close();
    expect(download).toHaveBeenCalledTimes(1);

    edit('unsaved-2-after-export');
    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(2);
  });

  it('#142: dismisses the open snackbar once a retry succeeds', async () => {
    const { failSave, succeedSave, refs, openFromComponent } = setUp();
    await failSave();
    expect(openFromComponent).toHaveBeenCalledTimes(1);

    succeedSave();

    expect(refs[0]!.dismiss).toHaveBeenCalledTimes(1);
  });

  it('#142: reopens for a later failure after a dismiss-on-success', async () => {
    const { failSave, succeedSave, openFromComponent } = setUp();
    await failSave();
    succeedSave();

    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(2);
  });

  it('#142: a stale afterDismissed from a dismissed-on-success snackbar cannot clobber a newer one', async () => {
    const { failSave, succeedSave, edit, refs, openFromComponent } = setUp();
    await failSave();
    const staleRef = refs[0]!;

    // Success dismisses staleRef, but (per the fake's decoupling above) its exit animation hasn't
    // completed yet: `afterDismissed` has not fired.
    succeedSave();
    expect(staleRef.dismiss).toHaveBeenCalledTimes(1);

    // A new failure opens a second, now-current snackbar before staleRef's animation finishes.
    edit('edit-during-stale-animation');
    await failSave();
    expect(openFromComponent).toHaveBeenCalledTimes(2);
    const currentRef = refs[1]!;

    // staleRef's exit animation finally completes. This must not reset state that belongs to
    // currentRef (the regression: it would clear `open`/`ref`, so a later success couldn't
    // dismiss the still-visible currentRef, and/or a later failure could stack a second snackbar).
    staleRef.dismissed.next();

    succeedSave();
    expect(currentRef.dismiss).toHaveBeenCalledTimes(1);
  });

  it('opens again for a new run of failures after a successful save', async () => {
    const { failSave, succeedSave, close, openFromComponent } = setUp();
    await failSave();
    close();

    succeedSave();
    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(2);
  });

  it('downloads the current document when "Export now" is used', async () => {
    const { failSave, refs, download } = setUp();
    await failSave();

    refs[0]!.action.next();

    expect(download).toHaveBeenCalledWith(
      'seven-habits-tools-backup.json',
      JSON.stringify({ schemaVersion: 1, v: 'initial' }, null, 2),
    );
  });

  it('tries again on the next failure if the snackbar could not be opened', async () => {
    const { failSave, openFromComponent } = setUp();
    openFromComponent.mockRejectedValueOnce(new Error('chunk load failed'));

    await failSave();
    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(2);
  });

  it('start() is idempotent', async () => {
    const { notifier, failSave, openFromComponent } = setUp();
    notifier.start();

    await failSave();

    expect(openFromComponent).toHaveBeenCalledTimes(1);
  });
});
