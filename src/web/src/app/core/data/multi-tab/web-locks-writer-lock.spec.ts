import { WebLocksWriterLock, WRITER_LOCK_NAME } from './web-locks-writer-lock';

/** A minimal fake `LockManager`: `request()` grants the lock to whichever caller is currently at
 * the front of a FIFO queue, exactly like the real Web Locks API serializes requests for the same
 * lock name. */
class FakeLockManager implements Pick<LockManager, 'request'> {
  private held = false;
  private readonly queue: (() => void)[] = [];

  request(
    name: string,
    optionsOrCallback: LockOptions | ((lock: Lock | null) => Promise<unknown>),
    maybeCallback?: (lock: Lock | null) => Promise<unknown>,
  ): Promise<unknown> {
    const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!;

    return new Promise((resolve, reject) => {
      const signal = options.signal;
      const grant = (): void => {
        this.held = true;
        void callback({ name, mode: 'exclusive' } as Lock).then(
          (value) => {
            this.held = false;
            this.advanceQueue();
            resolve(value);
          },
          (error) => {
            this.held = false;
            this.advanceQueue();
            reject(error);
          },
        );
      };

      if (!this.held) {
        grant();
      } else {
        this.queue.push(grant);
      }

      signal?.addEventListener('abort', () => {
        const index = this.queue.indexOf(grant);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new DOMException('Aborted', 'AbortError'));
        }
      });
    });
  }

  private advanceQueue(): void {
    this.queue.shift()?.();
  }
}

describe('WebLocksWriterLock', () => {
  it('is not the writer until the lock is granted', () => {
    const lock = new WebLocksWriterLock(new FakeLockManager() as unknown as LockManager);

    expect(lock.isWriter()).toBe(false);
  });

  it('becomes the writer once the lock is granted, uncontended', async () => {
    const lock = new WebLocksWriterLock(new FakeLockManager() as unknown as LockManager);

    lock.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(lock.isWriter()).toBe(true);
  });

  it('requests the lock by the shared writer lock name', () => {
    const manager = new FakeLockManager();
    const requestSpy = vi.spyOn(manager, 'request');
    const lock = new WebLocksWriterLock(manager as unknown as LockManager);

    lock.start();

    expect(requestSpy).toHaveBeenCalledWith(
      WRITER_LOCK_NAME,
      expect.anything(),
      expect.any(Function),
    );
  });

  it('stays a reader while another holder has the lock, then becomes writer once it releases', async () => {
    const manager = new FakeLockManager();
    const first = new WebLocksWriterLock(manager as unknown as LockManager);
    const second = new WebLocksWriterLock(manager as unknown as LockManager);

    first.start();
    await Promise.resolve();
    await Promise.resolve();
    second.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(first.isWriter()).toBe(true);
    expect(second.isWriter()).toBe(false);

    first.stop();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(first.isWriter()).toBe(false);
    expect(second.isWriter()).toBe(true);
  });

  it('stop() before the lock is granted cancels the pending request', async () => {
    const manager = new FakeLockManager();
    const holder = new WebLocksWriterLock(manager as unknown as LockManager);
    const waiting = new WebLocksWriterLock(manager as unknown as LockManager);
    holder.start();
    await Promise.resolve();
    await Promise.resolve();
    waiting.start();

    waiting.stop();
    await Promise.resolve();
    await Promise.resolve();

    expect(waiting.isWriter()).toBe(false);
    holder.stop();
    await Promise.resolve();
    await Promise.resolve();
    // The cancelled waiter never takes over; the lock simply has no holder afterwards.
    expect(waiting.isWriter()).toBe(false);
  });
});
