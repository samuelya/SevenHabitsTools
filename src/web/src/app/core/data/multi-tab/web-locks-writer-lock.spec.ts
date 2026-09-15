import { FakeLockManager } from './multi-tab.fakes';
import { WebLocksWriterLock, WRITER_LOCK_NAME } from './web-locks-writer-lock';

function createLock(manager: FakeLockManager): WebLocksWriterLock {
  return new WebLocksWriterLock(manager.asLockManager());
}

/** Lets every queued promise callback (lock grants, releases) run. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('WebLocksWriterLock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is pending, and not the writer, until the lock request settles', () => {
    const lock = createLock(new FakeLockManager());

    lock.start();

    expect(lock.role()).toBe('pending');
    expect(lock.isWriter()).toBe(false);
  });

  it('first asks for the shared lock name with ifAvailable', () => {
    const manager = new FakeLockManager();
    const requestSpy = vi.spyOn(manager, 'request');

    createLock(manager).start();

    expect(requestSpy).toHaveBeenCalledWith(
      WRITER_LOCK_NAME,
      { ifAvailable: true },
      expect.any(Function),
    );
  });

  it('becomes the writer without a promotion when the lock is free', async () => {
    const lock = createLock(new FakeLockManager());

    lock.start();
    await settle();

    expect(lock.role()).toBe('writer');
    expect(lock.promoted()).toBe(false);
  });

  it('#125: a slow but uncontended grant is still an initial grant, never a promotion', async () => {
    const lock = createLock(new FakeLockManager(2000));

    lock.start();
    await vi.advanceTimersByTimeAsync(1999);
    expect(lock.role()).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);

    expect(lock.role()).toBe('writer');
    expect(lock.promoted()).toBe(false);
  });

  it('is a confirmed reader while another tab holds the lock, then is promoted once it releases', async () => {
    const manager = new FakeLockManager();
    const first = createLock(manager);
    const second = createLock(manager);
    first.start();
    await settle();

    second.start();
    await settle();
    expect(second.role()).toBe('reader');
    expect(second.promoted()).toBe(false);

    first.stop();
    await settle();

    expect(first.isWriter()).toBe(false);
    expect(second.role()).toBe('writer');
    expect(second.promoted()).toBe(true);
  });

  it('stop() while waiting cancels the queued request, so it never takes over', async () => {
    const manager = new FakeLockManager();
    const holder = createLock(manager);
    const waiting = createLock(manager);
    holder.start();
    await settle();
    waiting.start();
    await settle();

    waiting.stop();
    holder.stop();
    await settle();

    expect(waiting.isWriter()).toBe(false);
    expect(waiting.promoted()).toBe(false);
  });

  it('stop() before the first answer arrives never becomes the writer', async () => {
    const lock = createLock(new FakeLockManager(50));

    lock.start();
    lock.stop();
    await vi.advanceTimersByTimeAsync(50);

    expect(lock.isWriter()).toBe(false);
  });
});
