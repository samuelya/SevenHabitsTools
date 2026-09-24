import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import documentV1Fixture from '../../../testing/fixtures/document-v1.json';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import {
  BROADCAST_CHANNEL_FACTORY,
  BroadcastChannelFactory,
} from '../../browser/broadcast-channel';
import { AppSnackbar } from '../../layout/app-snackbar';
import { CURRENT_SCHEMA_VERSION, RootDocument } from '../document.model';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { StorageAdapter, STORAGE_ADAPTER } from '../storage-adapter';
import { CrossTabSync } from './cross-tab-sync';
import { WRITER_LOCK } from './writer-lock';

/** Stands in for same-named `BroadcastChannel`s: every channel from one bus receives messages
 * posted by every *other* channel from that bus, matching real `BroadcastChannel` semantics
 * (a channel never receives its own messages). */
class FakeChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(private readonly peers: Set<FakeChannel>) {}
  postMessage(data: unknown): void {
    for (const peer of this.peers) {
      if (peer !== this) {
        peer.onmessage?.({ data } as MessageEvent);
      }
    }
  }
  close(): void {
    this.peers.delete(this);
  }
}

class FakeBroadcastBus {
  private readonly channels = new Set<FakeChannel>();
  readonly factory: BroadcastChannelFactory = () => {
    const channel = new FakeChannel(this.channels);
    this.channels.add(channel);
    return channel as unknown as BroadcastChannel;
  };
}

function sampleDoc(): RootDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { createdAt: 't', updatedAt: 't', appVersion: '0.0.0', deviceId: 'device-1' },
    profile: {},
    settings: {},
    shared: {},
    habits: {} as RootDocument['habits'],
    extras: {},
  };
}

interface FakeSnackbarRef {
  readonly dismissed: Subject<void>;
  readonly dismiss: ReturnType<typeof vi.fn>;
}

function setUp(
  options: {
    isWriter?: boolean;
    broadcastFactory?: BroadcastChannelFactory;
    initialLastSavedAt?: Date | null;
    load?: ReturnType<typeof vi.fn>;
  } = {},
): {
  crossTabSync: CrossTabSync;
  lastSavedAt: ReturnType<typeof signal<Date | null>>;
  replaceDocument: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  bus: FakeBroadcastBus;
  open: ReturnType<typeof vi.fn>;
  refs: FakeSnackbarRef[];
} {
  const bus = new FakeBroadcastBus();
  const lastSavedAt = signal<Date | null>(options.initialLastSavedAt ?? null);
  const replaceDocument = vi.fn();
  const load = options.load ?? vi.fn().mockResolvedValue(sampleDoc());
  const adapter: StorageAdapter = {
    kind: 'noop',
    load: load as StorageAdapter['load'],
    save: vi.fn(),
    clear: vi.fn(),
  };
  const refs: FakeSnackbarRef[] = [];
  const open = vi.fn(async () => {
    const ref: FakeSnackbarRef = {
      dismissed: new Subject<void>(),
      dismiss: vi.fn(() => ref.dismissed.next()),
    };
    refs.push(ref);
    return { afterDismissed: () => ref.dismissed, dismiss: ref.dismiss };
  });

  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: BROADCAST_CHANNEL_FACTORY, useValue: options.broadcastFactory ?? bus.factory },
      {
        provide: DocumentPersistence,
        useValue: { lastSavedAt: lastSavedAt.asReadonly() } as unknown as DocumentPersistence,
      },
      { provide: DocumentStore, useValue: { replaceDocument } as unknown as DocumentStore },
      { provide: STORAGE_ADAPTER, useValue: adapter },
      { provide: WRITER_LOCK, useValue: { isWriter: signal(options.isWriter ?? true) } },
      { provide: AppSnackbar, useValue: { open } },
    ],
  });

  return {
    crossTabSync: TestBed.inject(CrossTabSync),
    lastSavedAt,
    replaceDocument,
    load,
    bus,
    open,
    refs,
  };
}

describe('CrossTabSync', () => {
  it('does not throw when BroadcastChannel is unsupported', () => {
    expect(() => {
      const { crossTabSync } = setUp({ broadcastFactory: () => null });
      crossTabSync.start();
    }).not.toThrow();
  });

  it('does not broadcast the value DocumentPersistence already had when start() was called', () => {
    const { crossTabSync, bus } = setUp({ initialLastSavedAt: new Date('2026-01-01') });
    const bystander = bus.factory('sevenhabits-sync')!;
    const onmessage = vi.fn();
    bystander.onmessage = onmessage;

    crossTabSync.start();
    TestBed.tick();

    expect(onmessage).not.toHaveBeenCalled();
  });

  it('broadcasts once a save completes', () => {
    const { crossTabSync, lastSavedAt, bus } = setUp();
    const bystander = bus.factory('sevenhabits-sync')!;
    const onmessage = vi.fn();
    bystander.onmessage = onmessage;
    crossTabSync.start();
    TestBed.tick(); // flushes the effect's first (baseline) run

    lastSavedAt.set(new Date('2026-01-01'));
    TestBed.tick();

    expect(onmessage).toHaveBeenCalledTimes(1);
  });

  it('reloads the document from the adapter when a message arrives and this tab is read-only', async () => {
    const { crossTabSync, replaceDocument, load, bus } = setUp({ isWriter: false });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
    expect(replaceDocument).toHaveBeenCalledWith(await load.mock.results[0]!.value);
  });

  it('ignores an incoming message while this tab is the writer', async () => {
    const { crossTabSync, replaceDocument, load, bus } = setUp({ isWriter: true });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();

    expect(load).not.toHaveBeenCalled();
    expect(replaceDocument).not.toHaveBeenCalled();
  });

  it('start() is idempotent', () => {
    const { crossTabSync, lastSavedAt, bus } = setUp();
    const bystander = bus.factory('sevenhabits-sync')!;
    const onmessage = vi.fn();
    bystander.onmessage = onmessage;

    crossTabSync.start();
    crossTabSync.start();
    TestBed.tick(); // flushes the effect's first (baseline) run
    lastSavedAt.set(new Date('2026-01-01'));
    TestBed.tick();

    expect(onmessage).toHaveBeenCalledTimes(1);
  });

  it('runs a reloaded document through the same migrate-then-validate path as bootstrap', async () => {
    // documentV1Fixture (also used by migrate-document.spec.ts) is a version behind
    // CURRENT_SCHEMA_VERSION: the replaced document arriving migrated proves reloadFromAdapter()
    // routes through the shared resolveDocument() pipeline rather than bypassing it, matching
    // document-bootstrap.spec.ts's own "migrates and loads" test.
    const fixture = structuredClone(documentV1Fixture);
    const load = vi.fn().mockResolvedValue(fixture);
    const { crossTabSync, replaceDocument, bus } = setUp({ isWriter: false, load });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceDocument).toHaveBeenCalledWith({
      ...fixture,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
  });

  it('leaves the store unchanged and shows a reload notice for a document from a newer schema version', async () => {
    const tooNew = { ...sampleDoc(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    const load = vi.fn().mockResolvedValue(tooNew);
    const { crossTabSync, replaceDocument, open, bus } = setUp({ isWriter: false, load });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceDocument).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]![0]).toContain('Reload this tab');
  });

  it('leaves the store unchanged and shows a reload notice for a document with an invalid shape', async () => {
    const load = vi.fn().mockResolvedValue({ schemaVersion: CURRENT_SCHEMA_VERSION });
    const { crossTabSync, replaceDocument, open, bus } = setUp({ isWriter: false, load });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceDocument).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('catches a rejected load() and shows the reload notice once, without throwing', async () => {
    const load = vi.fn().mockRejectedValue(new Error('connection closed'));
    const { crossTabSync, replaceDocument, open, bus } = setUp({ isWriter: false, load });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    expect(() => bystander.postMessage({ type: 'saved' })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceDocument).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('never stacks a second reload notice while one is already open', async () => {
    const load = vi.fn().mockRejectedValue(new Error('connection closed'));
    const { crossTabSync, open, bus } = setUp({ isWriter: false, load });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('can show the reload notice again after the previous one was dismissed', async () => {
    const load = vi.fn().mockRejectedValue(new Error('connection closed'));
    const { crossTabSync, open, refs, bus } = setUp({ isWriter: false, load });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    refs[0]!.dismissed.next();

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(open).toHaveBeenCalledTimes(2);
  });

  it('dismisses a stale reload notice once a later reload succeeds', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection closed'))
      .mockResolvedValueOnce(sampleDoc());
    const { crossTabSync, replaceDocument, refs, bus } = setUp({ isWriter: false, load });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(refs[0]!.dismiss).not.toHaveBeenCalled();

    bystander.postMessage({ type: 'saved' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceDocument).toHaveBeenCalledTimes(1);
    expect(refs[0]!.dismiss).toHaveBeenCalledTimes(1);
  });

  it('does not try to dismiss a notice that was never opened when a reload succeeds', async () => {
    const { crossTabSync, replaceDocument, bus } = setUp({ isWriter: false });
    crossTabSync.start();
    const bystander = bus.factory('sevenhabits-sync')!;

    expect(() => bystander.postMessage({ type: 'saved' })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceDocument).toHaveBeenCalledTimes(1);
  });
});
