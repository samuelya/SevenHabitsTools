import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WINDOW } from '../../browser/window';
import {
  CLAIM_CONFIRM_DELAY_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  HEARTBEAT_STORAGE_KEY,
  HeartbeatWriterLock,
} from './heartbeat-writer-lock';
import { FakeLocalStorage, FakeLockManager, FakeWindowEvents } from './multi-tab.fakes';
import { WebLocksWriterLock } from './web-locks-writer-lock';
import { WriterLockStrategy } from './writer-lock-strategy';
import { WriterLockService } from './writer-lock.service';
import { WriterPromotionReload } from './writer-promotion-reload';

/** Starts `WriterPromotionReload` for one tab whose lock is `lock`; returns its reload spy. */
function startReloadFor(lock: Pick<WriterLockStrategy, 'promoted'>): ReturnType<typeof vi.fn> {
  const reload = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: WriterLockService, useValue: lock },
      { provide: WINDOW, useValue: { location: { reload } } },
    ],
  });
  TestBed.inject(WriterPromotionReload).start();
  TestBed.tick();
  return reload;
}

/** Advances fake time, then flushes effects so `WriterPromotionReload` sees the result. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  TestBed.tick();
}

describe('WriterPromotionReload', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reloads exactly once when promoted, even if start() is called twice', () => {
    const promoted = signal(false);
    const reload = startReloadFor({ promoted });
    TestBed.inject(WriterPromotionReload).start();

    promoted.set(true);
    TestBed.tick();
    TestBed.tick();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  describe('with Web Locks', () => {
    it('#125: an uncontended grant that takes 2 s never reloads', async () => {
      const lock = new WebLocksWriterLock(new FakeLockManager(2000).asLockManager());
      const reload = startReloadFor(lock);

      lock.start();
      await advance(2000);
      await advance(10_000);

      expect(lock.isWriter()).toBe(true);
      expect(reload).not.toHaveBeenCalled();
    });

    it('#125: a contended tab reloads exactly once when the writer releases', async () => {
      const manager = new FakeLockManager();
      const writer = new WebLocksWriterLock(manager.asLockManager());
      writer.start();
      await advance(0);
      const reader = new WebLocksWriterLock(manager.asLockManager());
      const reload = startReloadFor(reader);
      reader.start();
      await advance(10_000);
      expect(reload).not.toHaveBeenCalled();

      writer.stop();
      await advance(10_000);

      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('with the heartbeat fallback', () => {
    const takeoverMs = HEARTBEAT_STALE_MS + HEARTBEAT_INTERVAL_MS + CLAIM_CONFIRM_DELAY_MS;

    it('#126: a single tab never reloads', async () => {
      const lock = new HeartbeatWriterLock(new FakeLocalStorage(), new FakeWindowEvents(), 'a');
      const reload = startReloadFor(lock);

      lock.start();
      await advance(HEARTBEAT_STALE_MS * 4);

      expect(reload).not.toHaveBeenCalled();
    });

    it('#126: while the writer is alive, the reader never reloads', async () => {
      const storage = new FakeLocalStorage();
      new HeartbeatWriterLock(storage, new FakeWindowEvents(), 'a').start();
      await advance(CLAIM_CONFIRM_DELAY_MS);
      const reader = new HeartbeatWriterLock(storage, new FakeWindowEvents(), 'b');
      const reload = startReloadFor(reader);

      reader.start();
      await advance(HEARTBEAT_STALE_MS * 4);

      expect(reload).not.toHaveBeenCalled();
    });

    it('#126: once the writer is gone, the reader reloads exactly once within the timeout', async () => {
      const storage = new FakeLocalStorage();
      // A writer tab that crashed: no pagehide, so its last heartbeat is left behind.
      storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify({ tabId: 'a', at: Date.now() }));
      const reader = new HeartbeatWriterLock(storage, new FakeWindowEvents(), 'b');
      const reload = startReloadFor(reader);
      reader.start();
      await advance(0);
      expect(reader.role()).toBe('reader');

      await advance(takeoverMs);

      expect(reload).toHaveBeenCalledTimes(1);
      await advance(HEARTBEAT_STALE_MS * 4);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
