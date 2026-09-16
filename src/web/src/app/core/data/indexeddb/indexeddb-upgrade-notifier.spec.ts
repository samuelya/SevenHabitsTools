import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { WINDOW } from '../../browser/window';
import { AppSnackbar } from '../../layout/app-snackbar';
import { DocumentPersistence } from '../document-persistence';
import { IndexedDbAdapter } from './indexeddb-adapter';
import { IndexedDbUpgradeNotifier } from './indexeddb-upgrade-notifier';

interface FakeRef {
  readonly action: Subject<void>;
}

function setUp(): {
  notifier: IndexedDbUpgradeNotifier;
  connectionSuperseded: ReturnType<typeof signal<number>>;
  open: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  refs: FakeRef[];
} {
  const connectionSuperseded = signal(0);
  const flush = vi.fn().mockResolvedValue(undefined);
  const reload = vi.fn();
  const refs: FakeRef[] = [];
  const open = vi.fn(async () => {
    const ref: FakeRef = { action: new Subject<void>() };
    refs.push(ref);
    return { onAction: () => ref.action };
  });

  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      {
        provide: IndexedDbAdapter,
        useValue: { connectionSuperseded } as unknown as IndexedDbAdapter,
      },
      { provide: DocumentPersistence, useValue: { flush } as unknown as DocumentPersistence },
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
    refs,
  };
}

describe('IndexedDbUpgradeNotifier', () => {
  it('shows nothing until a connection is superseded', () => {
    const { notifier, open } = setUp();

    notifier.start();
    TestBed.tick();

    expect(open).not.toHaveBeenCalled();
  });

  it('#139: prompts to reload once another tab supersedes this connection', () => {
    const { notifier, connectionSuperseded, open } = setUp();
    notifier.start();
    TestBed.tick();

    connectionSuperseded.set(1);
    TestBed.tick();

    expect(open).toHaveBeenCalledTimes(1);
    const [message, action] = open.mock.calls[0]! as unknown as [string, string];
    expect(message).toContain('reload');
    expect(action).toBe('Reload');
  });

  it('does not report a supersede that happened before it started', () => {
    const { notifier, connectionSuperseded, open } = setUp();
    connectionSuperseded.set(2);

    notifier.start();
    TestBed.tick();

    expect(open).not.toHaveBeenCalled();
  });

  it('flushes any pending edit, then reloads, when Reload is clicked', async () => {
    const { notifier, connectionSuperseded, flush, reload, refs } = setUp();
    notifier.start();
    TestBed.tick();
    connectionSuperseded.set(1);
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();

    refs[0]!.action.next();
    await Promise.resolve();
    await Promise.resolve();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the flush fails', async () => {
    const { notifier, connectionSuperseded, reload, refs, flush } = setUp();
    flush.mockRejectedValue(new Error('boom'));
    notifier.start();
    TestBed.tick();
    connectionSuperseded.set(1);
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();

    refs[0]!.action.next();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(reload).toHaveBeenCalledTimes(1);
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
