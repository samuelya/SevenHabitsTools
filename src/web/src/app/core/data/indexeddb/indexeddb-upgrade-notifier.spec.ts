import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { FileDownloader } from '../../browser/file-download';
import { WINDOW } from '../../browser/window';
import { AppSnackbar } from '../../layout/app-snackbar';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { SaveErrorNotifier } from '../save-error-notifier';
import { IndexedDbAdapter } from './indexeddb-adapter';
import { IndexedDbUpgradeNotifier } from './indexeddb-upgrade-notifier';

interface FakeRef {
  readonly action: Subject<void>;
  readonly dismissed: Subject<void>;
}

const DOCUMENT = { meta: { schemaVersion: 1 } };

function setUp(options: { dirty?: boolean; saveError?: unknown } = {}): {
  notifier: IndexedDbUpgradeNotifier;
  connectionSuperseded: ReturnType<typeof signal<number>>;
  open: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  download: ReturnType<typeof vi.fn>;
  refs: FakeRef[];
  setDirty: (value: boolean) => void;
  setSaveError: (value: unknown) => void;
} {
  const connectionSuperseded = signal(0);
  const flush = vi.fn().mockResolvedValue(undefined);
  const reload = vi.fn();
  const download = vi.fn();
  const refs: FakeRef[] = [];
  const open = vi.fn(async () => {
    const ref: FakeRef = { action: new Subject<void>(), dismissed: new Subject<void>() };
    refs.push(ref);
    return { onAction: () => ref.action, afterDismissed: () => ref.dismissed };
  });
  let dirty = options.dirty ?? false;
  let saveError: unknown = options.saveError ?? null;
  const persistence = {
    flush,
    dirty: () => dirty,
    saveError: () => saveError,
  };

  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      {
        provide: IndexedDbAdapter,
        useValue: { connectionSuperseded } as unknown as IndexedDbAdapter,
      },
      { provide: DocumentPersistence, useValue: persistence as unknown as DocumentPersistence },
      {
        provide: DocumentStore,
        useValue: { document: () => DOCUMENT } as unknown as DocumentStore,
      },
      { provide: FileDownloader, useValue: { download } },
      { provide: WINDOW, useValue: { location: { reload } } },
      { provide: AppSnackbar, useValue: { open } },
    ],
  });

  return {
    notifier: TestBed.inject(IndexedDbUpgradeNotifier),
    connectionSuperseded,
    open,
    flush,
    reload,
    download,
    refs,
    setDirty: (value: boolean) => {
      dirty = value;
    },
    setSaveError: (value: unknown) => {
      saveError = value;
    },
  };
}

/** Supersedes the connection and waits for the resulting snackbar to open. */
async function supersede(context: ReturnType<typeof setUp>): Promise<void> {
  context.notifier.start();
  TestBed.tick();
  context.connectionSuperseded.set(1);
  TestBed.tick();
  await Promise.resolve();
  await Promise.resolve();
}

/** Clicks a prompt's action and waits for whatever it triggers to settle. */
async function clickAction(ref: FakeRef): Promise<void> {
  ref.action.next();
  ref.dismissed.next();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function messageOf(open: ReturnType<typeof vi.fn>, call: number): string {
  return (open.mock.calls[call] as unknown as [string, string])[0];
}

function actionOf(open: ReturnType<typeof vi.fn>, call: number): string {
  return (open.mock.calls[call] as unknown as [string, string])[1];
}

describe('IndexedDbUpgradeNotifier', () => {
  it('shows nothing until a connection is superseded', () => {
    const { notifier, open } = setUp();

    notifier.start();
    TestBed.tick();

    expect(open).not.toHaveBeenCalled();
  });

  it('#139: prompts to reload once another tab supersedes this connection', async () => {
    const context = setUp();
    await supersede(context);

    expect(context.open).toHaveBeenCalledTimes(1);
    expect(messageOf(context.open, 0)).toContain('Reload this tab');
    expect(actionOf(context.open, 0)).toBe('Reload');
  });

  it('#139: silences the save-error snackbar, which would otherwise replace the reload prompt', async () => {
    const context = setUp();
    const suppress = vi.spyOn(TestBed.inject(SaveErrorNotifier), 'suppress');

    await supersede(context);

    expect(suppress).toHaveBeenCalled();
  });

  it('does not report a supersede that happened before it started', () => {
    const { notifier, connectionSuperseded, open } = setUp();
    connectionSuperseded.set(2);

    notifier.start();
    TestBed.tick();

    expect(open).not.toHaveBeenCalled();
  });

  it('flushes any pending edit, then reloads, when Reload is clicked', async () => {
    const context = setUp();
    await supersede(context);

    await clickAction(context.refs[0]!);

    expect(context.flush).toHaveBeenCalledTimes(1);
    expect(context.reload).toHaveBeenCalledTimes(1);
  });

  it('#139: offers an export instead of looping when the edit can never be saved', async () => {
    const context = setUp({ dirty: true });
    await supersede(context);

    await clickAction(context.refs[0]!);

    expect(context.reload).not.toHaveBeenCalled();
    expect(context.open).toHaveBeenCalledTimes(2);
    expect(messageOf(context.open, 1)).toContain("can't save anymore");
    expect(actionOf(context.open, 1)).toBe('Export now');
  });

  it('#139: exports the document and then reloads, even though it is still unsaved', async () => {
    const context = setUp({ dirty: true });
    await supersede(context);
    await clickAction(context.refs[0]!);

    await clickAction(context.refs[1]!);

    expect(context.download).toHaveBeenCalledWith(
      'seven-habits-tools-backup.json',
      JSON.stringify(DOCUMENT, null, 2),
    );
    expect(context.open).toHaveBeenCalledTimes(3);
    expect(context.reload).not.toHaveBeenCalled();

    await clickAction(context.refs[2]!);

    expect(context.reload).toHaveBeenCalledTimes(1);
  });

  it('offers the export when the last save is failing too', async () => {
    const context = setUp();
    context.setSaveError(new Error('quota'));
    await supersede(context);

    await clickAction(context.refs[0]!);

    expect(context.reload).not.toHaveBeenCalled();
    expect(actionOf(context.open, 1)).toBe('Export now');
  });

  it('does not stack a second prompt when another connection is superseded', async () => {
    const context = setUp();
    await supersede(context);

    context.connectionSuperseded.set(2);
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();

    expect(context.open).toHaveBeenCalledTimes(1);
  });

  it('prompts again once the user has dismissed the previous prompt', async () => {
    const context = setUp();
    await supersede(context);

    context.refs[0]!.dismissed.next();
    context.connectionSuperseded.set(2);
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();

    expect(context.open).toHaveBeenCalledTimes(2);
  });

  it('start() is idempotent', () => {
    const { notifier, connectionSuperseded, open } = setUp();
    notifier.start();
    notifier.start();
    TestBed.tick();

    connectionSuperseded.set(1);
    TestBed.tick();

    expect(open).toHaveBeenCalledTimes(1);
  });
});
