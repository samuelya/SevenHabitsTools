import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BROADCAST_CHANNEL_FACTORY,
  BroadcastChannelFactory,
} from '../../browser/broadcast-channel';
import { RootDocument } from '../document.model';
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
    schemaVersion: 1,
    meta: { createdAt: 't', updatedAt: 't', appVersion: '0.0.0', deviceId: 'device-1' },
    profile: {},
    settings: {},
    shared: {},
    habits: {} as RootDocument['habits'],
    extras: {},
  };
}

function setUp(
  options: {
    isWriter?: boolean;
    broadcastFactory?: BroadcastChannelFactory;
    initialLastSavedAt?: Date | null;
  } = {},
): {
  crossTabSync: CrossTabSync;
  lastSavedAt: ReturnType<typeof signal<Date | null>>;
  replaceDocument: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  bus: FakeBroadcastBus;
} {
  const bus = new FakeBroadcastBus();
  const lastSavedAt = signal<Date | null>(options.initialLastSavedAt ?? null);
  const replaceDocument = vi.fn();
  const load = vi.fn().mockResolvedValue(sampleDoc());
  const adapter: StorageAdapter = { kind: 'noop', load, save: vi.fn(), clear: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      { provide: BROADCAST_CHANNEL_FACTORY, useValue: options.broadcastFactory ?? bus.factory },
      {
        provide: DocumentPersistence,
        useValue: { lastSavedAt: lastSavedAt.asReadonly() } as unknown as DocumentPersistence,
      },
      { provide: DocumentStore, useValue: { replaceDocument } as unknown as DocumentStore },
      { provide: STORAGE_ADAPTER, useValue: adapter },
      { provide: WRITER_LOCK, useValue: { isWriter: signal(options.isWriter ?? true) } },
    ],
  });

  return { crossTabSync: TestBed.inject(CrossTabSync), lastSavedAt, replaceDocument, load, bus };
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
});
