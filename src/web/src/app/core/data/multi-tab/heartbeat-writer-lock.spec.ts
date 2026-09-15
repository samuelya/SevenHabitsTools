import {
  CLAIM_CONFIRM_DELAY_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  HEARTBEAT_STORAGE_KEY,
  HeartbeatWriterLock,
} from './heartbeat-writer-lock';
import { FakeLocalStorage, FakeWindowEvents } from './multi-tab.fakes';

function createLock(
  storage: FakeLocalStorage,
  tabId: string,
  windowEvents = new FakeWindowEvents(),
): HeartbeatWriterLock {
  return new HeartbeatWriterLock(storage, windowEvents, tabId);
}

function storedTabId(storage: FakeLocalStorage): string | undefined {
  const raw = storage.getItem(HEARTBEAT_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { tabId: string }).tabId : undefined;
}

/** Starts `tabId` as the writer on `storage`. */
async function startWriter(
  storage: FakeLocalStorage,
  tabId: string,
  windowEvents = new FakeWindowEvents(),
): Promise<HeartbeatWriterLock> {
  const writer = createLock(storage, tabId, windowEvents);
  writer.start();
  await vi.advanceTimersByTimeAsync(CLAIM_CONFIRM_DELAY_MS);
  return writer;
}

describe('HeartbeatWriterLock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is pending until its claim is confirmed', () => {
    const lock = createLock(new FakeLocalStorage(), 'tab-a');

    lock.start();

    expect(lock.role()).toBe('pending');
  });

  it('becomes the writer, uncontested, without a promotion', async () => {
    const lock = await startWriter(new FakeLocalStorage(), 'tab-a');

    expect(lock.role()).toBe('writer');
    expect(lock.promoted()).toBe(false);
  });

  it('a tab starting against a fresh heartbeat is a confirmed reader straight away', async () => {
    const storage = new FakeLocalStorage();
    await startWriter(storage, 'tab-a');
    const reader = createLock(storage, 'tab-b');

    reader.start();

    expect(reader.role()).toBe('reader');
  });

  it('loses a claim race when another tab overwrites the claim before it is confirmed', async () => {
    const storage = new FakeLocalStorage();
    const lock = createLock(storage, 'tab-a');

    lock.start();
    storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify({ tabId: 'tab-b', at: Date.now() }));
    await vi.advanceTimersByTimeAsync(CLAIM_CONFIRM_DELAY_MS);

    expect(lock.role()).toBe('reader');
  });

  it('#126: while the writer is alive, a reader never takes over', async () => {
    const storage = new FakeLocalStorage();
    const writer = await startWriter(storage, 'tab-a');
    const reader = createLock(storage, 'tab-b');
    reader.start();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_STALE_MS * 3);

    expect(writer.role()).toBe('writer');
    expect(reader.role()).toBe('reader');
    expect(reader.promoted()).toBe(false);
  });

  it('#126: once the writer is gone without clearing its entry, a reader is promoted within the timeout', async () => {
    const storage = new FakeLocalStorage();
    // A writer tab that crashed: its heartbeat stays in storage and is never refreshed again.
    storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify({ tabId: 'tab-a', at: Date.now() }));
    const reader = createLock(storage, 'tab-b');
    reader.start();
    expect(reader.role()).toBe('reader');

    await vi.advanceTimersByTimeAsync(
      HEARTBEAT_STALE_MS + HEARTBEAT_INTERVAL_MS + CLAIM_CONFIRM_DELAY_MS,
    );

    expect(reader.role()).toBe('writer');
    expect(reader.promoted()).toBe(true);
  });

  it('#126: pagehide removes its own entry, so the next tab to check can claim at once', async () => {
    const storage = new FakeLocalStorage();
    const writerEvents = new FakeWindowEvents();
    await startWriter(storage, 'tab-a', writerEvents);

    writerEvents.dispatch('pagehide');

    expect(storage.getItem(HEARTBEAT_STORAGE_KEY)).toBeNull();
    const next = await startWriter(storage, 'tab-b');
    expect(next.role()).toBe('writer');
  });

  it('#126: the page reloaded after a promotion starts as the writer, not as a reader of its own old entry', async () => {
    const storage = new FakeLocalStorage();
    storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify({ tabId: 'tab-a', at: Date.now() }));
    const promotedEvents = new FakeWindowEvents();
    const promoted = createLock(storage, 'tab-b-page-1', promotedEvents);
    promoted.start();
    await vi.advanceTimersByTimeAsync(
      HEARTBEAT_STALE_MS + HEARTBEAT_INTERVAL_MS + CLAIM_CONFIRM_DELAY_MS,
    );
    expect(promoted.promoted()).toBe(true);

    // WriterPromotionReload reloads the page: pagehide fires, then a new page with a new tab id.
    promotedEvents.dispatch('pagehide');
    const reloaded = await startWriter(storage, 'tab-b-page-2');

    expect(reloaded.role()).toBe('writer');
    expect(reloaded.promoted()).toBe(false);
  });

  it("does not clear the entry on pagehide once it is another tab's", async () => {
    const storage = new FakeLocalStorage();
    const writerEvents = new FakeWindowEvents();
    await startWriter(storage, 'tab-a', writerEvents);
    storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify({ tabId: 'tab-b', at: Date.now() }));

    writerEvents.dispatch('pagehide');

    expect(storedTabId(storage)).toBe('tab-b');
  });

  it('keeps renewing its heartbeat while it is the writer', async () => {
    const storage = new FakeLocalStorage();
    await startWriter(storage, 'tab-a');
    const before = JSON.parse(storage.getItem(HEARTBEAT_STORAGE_KEY)!) as { at: number };

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    const after = JSON.parse(storage.getItem(HEARTBEAT_STORAGE_KEY)!) as { at: number };
    expect(after.at).toBeGreaterThan(before.at);
  });

  it('steps down instead of overwriting when another tab has taken the entry over', async () => {
    const storage = new FakeLocalStorage();
    const writer = await startWriter(storage, 'tab-a');
    storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify({ tabId: 'tab-b', at: Date.now() }));

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(writer.role()).toBe('reader');
    expect(storedTabId(storage)).toBe('tab-b');
  });

  it('stop() stops renewing, releases its entry and is no longer the writer', async () => {
    const storage = new FakeLocalStorage();
    const writer = await startWriter(storage, 'tab-a');

    writer.stop();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(writer.isWriter()).toBe(false);
    expect(storage.getItem(HEARTBEAT_STORAGE_KEY)).toBeNull();
  });
});
