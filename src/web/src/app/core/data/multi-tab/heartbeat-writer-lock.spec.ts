import { LocalStorageLike } from '../../browser/local-storage';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  HEARTBEAT_STORAGE_KEY,
  HeartbeatWriterLock,
} from './heartbeat-writer-lock';

const CONFIRM_DELAY_MS = 100;

class FakeLocalStorage implements LocalStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('HeartbeatWriterLock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is not the writer until its claim is confirmed', () => {
    const lock = new HeartbeatWriterLock(new FakeLocalStorage(), 'tab-a');

    lock.start();

    expect(lock.isWriter()).toBe(false);
  });

  it('becomes the writer, uncontested, once the confirm delay passes', async () => {
    const lock = new HeartbeatWriterLock(new FakeLocalStorage(), 'tab-a');

    lock.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);

    expect(lock.isWriter()).toBe(true);
  });

  it('a second tab starting against a fresh heartbeat stays a reader', async () => {
    const storage = new FakeLocalStorage();
    const first = new HeartbeatWriterLock(storage, 'tab-a');
    const second = new HeartbeatWriterLock(storage, 'tab-b');

    first.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    second.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);

    expect(first.isWriter()).toBe(true);
    expect(second.isWriter()).toBe(false);
  });

  it('loses the claim if another tab overwrites the heartbeat before the confirm delay elapses', async () => {
    // localStorage has no compare-and-swap: this reproduces the window the class's own doc
    // comment calls out, where two tabs' writes land within the same confirm delay.
    const storage = new FakeLocalStorage();
    const lock = new HeartbeatWriterLock(storage, 'tab-a');

    lock.start(); // writes tab-a's heartbeat and starts waiting to confirm it
    storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify({ tabId: 'tab-b', at: Date.now() }));
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);

    expect(lock.isWriter()).toBe(false);
  });

  it('a reader claims the lock once the writer stops heartbeating and it goes stale', async () => {
    const storage = new FakeLocalStorage();
    const writer = new HeartbeatWriterLock(storage, 'tab-a');
    const reader = new HeartbeatWriterLock(storage, 'tab-b');
    writer.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    reader.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(reader.isWriter()).toBe(false);

    // Simulate the writer's tab disappearing: nothing refreshes its heartbeat from here on.
    writer.stop();
    // Comfortably past both the staleness threshold and at least one of the reader's own polls.
    await vi.advanceTimersByTimeAsync(
      HEARTBEAT_STALE_MS + HEARTBEAT_INTERVAL_MS + CONFIRM_DELAY_MS,
    );

    expect(reader.isWriter()).toBe(true);
  });

  it('keeps refreshing its own heartbeat so it is never mistaken for stale', async () => {
    const storage = new FakeLocalStorage();
    const writer = new HeartbeatWriterLock(storage, 'tab-a');
    const reader = new HeartbeatWriterLock(storage, 'tab-b');
    writer.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    reader.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_STALE_MS * 3);

    expect(writer.isWriter()).toBe(true);
    expect(reader.isWriter()).toBe(false);
  });

  it('stop() clears its refresh timer and stops reporting as writer', async () => {
    const storage = new FakeLocalStorage();
    const writer = new HeartbeatWriterLock(storage, 'tab-a');
    writer.start();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(writer.isWriter()).toBe(true);

    writer.stop();

    expect(writer.isWriter()).toBe(false);
  });
});
