import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../browser/window';
import { DocumentBootstrapStatus } from './document-bootstrap-status';
import {
  DocumentPersistence,
  SAVE_DEBOUNCE_MS,
  SAVE_RETRY_MAX_MS,
  SAVE_RETRY_MS,
} from './document-persistence';
import { DocumentStore } from './document.store';
import { WRITER_LOCK } from './multi-tab/writer-lock';
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

function setUp(options: { isWriter?: ReturnType<typeof signal<boolean>> } = {}): {
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
  const isWriter = options.isWriter ?? signal(true);

  TestBed.configureTestingModule({
    providers: [
      { provide: DOCUMENT, useValue: fakeDocument },
      { provide: WINDOW, useValue: fakeWindow },
      { provide: STORAGE_ADAPTER, useValue: adapter },
      { provide: WRITER_LOCK, useValue: { isWriter: isWriter.asReadonly() } },
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

  it('doubles the retry delay on consecutive failures, up to SAVE_RETRY_MAX_MS, and resets it after a success', async () => {
    const { persistence, store, save } = setUp();
    save.mockRejectedValueOnce(new Error('e1'));
    save.mockRejectedValueOnce(new Error('e2'));
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1); // first attempt fails

    await vi.advanceTimersByTimeAsync(SAVE_RETRY_MS - 1);
    expect(save).toHaveBeenCalledTimes(1); // not yet retried
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2); // retry #1 (after SAVE_RETRY_MS) fails too

    await vi.advanceTimersByTimeAsync(SAVE_RETRY_MS * 2 - 1);
    expect(save).toHaveBeenCalledTimes(2); // retry #2 needs double the delay
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(3); // retry #2 (after 2 x SAVE_RETRY_MS) succeeds

    expect(persistence.dirty()).toBe(false);
    expect(persistence.saveError()).toBeNull();
    expect(SAVE_RETRY_MS * 2).toBeLessThan(SAVE_RETRY_MAX_MS);
  });

  it('never calls adapter.save while the loaded document is reported corrupt (#111)', async () => {
    const { persistence, store, save } = setUp();
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt({ schemaVersion: 99 }, new Error('bad'));
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    await persistence.flush();

    expect(save).not.toHaveBeenCalled();
    expect(persistence.dirty()).toBe(true);
  });

  it('resumes saving once status returns to ready', async () => {
    const { persistence, store, save } = setUp();
    const status = TestBed.inject(DocumentBootstrapStatus);
    status.reportCorrupt({ schemaVersion: 99 }, new Error('bad'));
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).not.toHaveBeenCalled();

    status.reportReady();
    store.update('settings', () => ({ theme: 'darker' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(persistence.dirty()).toBe(false);
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

  it('never marks the document dirty while this tab is read-only (#35)', async () => {
    const isWriter = signal(false);
    const { persistence, store, save } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    // A read-only tab's document only changes because CrossTabSync reloaded it (DocumentStore
    // refuses edits there, #127); that reload must not look like a local edit.
    store.replaceDocument({ ...store.document(), settings: { theme: 'dark' } });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(persistence.dirty()).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('never calls adapter.save while this tab is read-only, even if it loses the lock mid-save (#35)', async () => {
    const isWriter = signal(true);
    const { persistence, store, save } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    isWriter.set(false); // lost the lock before the debounced save runs
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(save).not.toHaveBeenCalled();
    expect(persistence.dirty()).toBe(true); // stays dirty in case this tab ever becomes writer
  });

  it('saveNow() saves the document replaced before start() ever fired its effect', async () => {
    // Regression for #37: a caller (JSON import) that calls `replaceDocument()` and then
    // immediately `saveNow()`, in the same synchronous turn, must not depend on `start()`'s
    // `effect()` having already run — it hasn't, since effects are flushed on the next Angular
    // tick, not synchronously on a signal write.
    const { persistence, store, save } = setUp();
    persistence.start();
    TestBed.tick();

    store.replaceDocument({ ...store.document(), settings: { imported: true } });
    await persistence.saveNow();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual(
      expect.objectContaining({ settings: { imported: true } }),
    );
    expect(persistence.dirty()).toBe(false);
  });

  it('saveNow() cancels a pending debounce timer instead of saving twice', async () => {
    const { persistence, store, save } = setUp();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await persistence.saveNow();

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saveNow() stays dirty and never saves while this tab is read-only', async () => {
    const isWriter = signal(false);
    const { persistence, store, save } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    store.replaceDocument({ ...store.document(), settings: { imported: true } });
    await persistence.saveNow();

    expect(save).not.toHaveBeenCalled();
    expect(persistence.dirty()).toBe(true);
  });

  it('resumes saving once this tab becomes the writer', async () => {
    const isWriter = signal(false);
    const { persistence, store, save } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).not.toHaveBeenCalled();

    isWriter.set(true);
    store.update('settings', () => ({ theme: 'darker' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(persistence.dirty()).toBe(false);
  });

  it('#150 regression: retries a saveNow() that could not go through before this tab became the writer', async () => {
    // Models the corrupt-recovery import: DocumentStore.replaceDocument() + saveNow() run right
    // after DocumentSync.start(), racing the real (asynchronous) writer-lock grant — isWriter is
    // still false the instant saveNow() checks it.
    const isWriter = signal(false);
    const { persistence, store, save } = setUp({ isWriter });
    persistence.start();
    TestBed.tick();

    store.replaceDocument({ ...store.document(), settings: { recovered: true } });
    await persistence.saveNow();
    expect(save).not.toHaveBeenCalled();
    expect(persistence.dirty()).toBe(true); // stays dirty, waiting to be retried

    isWriter.set(true); // the grant resolves a moment later
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual(
      expect.objectContaining({ settings: { recovered: true } }),
    );
    expect(persistence.dirty()).toBe(false);
  });

  it('does not re-save on every ordinary edit while this tab is already the writer (only on the not-writer -> writer edge)', async () => {
    const { persistence, store, save } = setUp();
    persistence.start();
    TestBed.tick();

    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();

    // Immediately after the edit, still inside the debounce window: the retry-on-writer-edge
    // effect must not have fired an out-of-band save just because isWriter() and dirty() both
    // happen to be true.
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
