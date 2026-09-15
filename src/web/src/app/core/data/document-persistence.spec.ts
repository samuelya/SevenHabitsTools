import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../browser/window';
import { DocumentPersistence, SAVE_DEBOUNCE_MS, SAVE_RETRY_MS } from './document-persistence';
import { DocumentStore } from './document.store';
import { StorageAdapter, STORAGE_ADAPTER } from './storage-adapter';

class FakeEventTarget {
  private readonly listeners = new Map<string, () => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(type, listener as () => void);
  }

  removeEventListener(type: string): void {
    this.listeners.delete(type);
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.();
  }
}

function setUp(): {
  persistence: DocumentPersistence;
  store: DocumentStore;
  save: ReturnType<typeof vi.fn>;
  fakeDocument: FakeEventTarget & { visibilityState: DocumentVisibilityState };
  fakeWindow: FakeEventTarget;
} {
  const save = vi.fn().mockResolvedValue(undefined);
  const adapter: StorageAdapter = {
    kind: 'noop',
    load: vi.fn(),
    save: save as unknown as StorageAdapter['save'],
    clear: vi.fn(),
  };
  const fakeDocument = Object.assign(new FakeEventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  });
  const fakeWindow = new FakeEventTarget();

  TestBed.configureTestingModule({
    providers: [
      { provide: DOCUMENT, useValue: fakeDocument },
      { provide: WINDOW, useValue: fakeWindow },
      { provide: STORAGE_ADAPTER, useValue: adapter },
    ],
  });
  return {
    persistence: TestBed.inject(DocumentPersistence),
    store: TestBed.inject(DocumentStore),
    save,
    fakeDocument,
    fakeWindow,
  };
}

describe('DocumentPersistence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not save the document loaded before start()', () => {
    const { persistence, save } = setUp();

    persistence.start();
    TestBed.tick();

    expect(save).not.toHaveBeenCalled();
    expect(persistence.dirty()).toBe(false);
  });

  it('marks dirty immediately and saves after the debounce window', async () => {
    const { persistence, store, save } = setUp();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    expect(persistence.dirty()).toBe(true);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual({ reason: 'debounce' });
    expect(persistence.dirty()).toBe(false);
    expect(persistence.lastSavedAt()).not.toBeNull();
  });

  it('coalesces rapid changes into a single debounced save', async () => {
    const { persistence, store, save } = setUp();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS / 2);
    store.update('settings', () => ({ theme: 'darker' }));
    TestBed.tick();

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush() saves immediately and cancels the pending debounce timer', async () => {
    const { persistence, store, save } = setUp();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await persistence.flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual({ reason: 'flush' });

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush() is a no-op when nothing is dirty', async () => {
    const { persistence, save } = setUp();
    persistence.start();
    TestBed.tick();

    await persistence.flush();

    expect(save).not.toHaveBeenCalled();
  });

  it('flushes on visibilitychange to hidden', async () => {
    const { persistence, store, save, fakeDocument } = setUp();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    fakeDocument.visibilityState = 'hidden';
    fakeDocument.dispatch('visibilitychange');
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flushes on pagehide', async () => {
    const { persistence, store, save, fakeWindow } = setUp();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    fakeWindow.dispatch('pagehide');
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves a newer edit that landed while an earlier save was still in flight', async () => {
    const { persistence, store, save } = setUp();
    let resolveFirstSave = (): void => undefined;
    save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstSave = resolve;
        }),
    );
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ v: 'first' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(persistence.dirty()).toBe(true); // the first save has not resolved yet

    store.update('settings', () => ({ v: 'second' }));
    TestBed.tick();

    resolveFirstSave();
    await persistence.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual(expect.objectContaining({ settings: { v: 'second' } }));
    expect(persistence.dirty()).toBe(false);
  });

  it('catches a failed save instead of an unhandled rejection, and retries', async () => {
    const { persistence, store, save } = setUp();
    save.mockRejectedValueOnce(new Error('quota'));
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(persistence.dirty()).toBe(true);
    expect(persistence.saveError()).toBeInstanceOf(Error);
    expect(persistence.lastSavedAt()).toBeNull();

    await vi.advanceTimersByTimeAsync(SAVE_RETRY_MS);

    expect(save).toHaveBeenCalledTimes(2);
    expect(persistence.dirty()).toBe(false);
    expect(persistence.saveError()).toBeNull();
    expect(persistence.lastSavedAt()).not.toBeNull();
  });

  it('start() is idempotent', () => {
    const { persistence, store, save } = setUp();
    persistence.start();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();

    expect(persistence.dirty()).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
