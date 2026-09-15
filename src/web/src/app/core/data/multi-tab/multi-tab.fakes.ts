import { LocalStorageLike } from '../../browser/local-storage';
import { WindowEvents } from './heartbeat-writer-lock';

/** Test-only in-memory `localStorage`, shared between the "tabs" of one test. */
export class FakeLocalStorage implements LocalStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/** Test-only `Window` events, with `dispatch()` standing in for the browser firing `pagehide`. */
export class FakeWindowEvents implements WindowEvents {
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener());
  }
}

type GrantedCallback = (lock: Lock | null) => unknown;

/**
 * Test-only `LockManager` for one exclusive lock, shared between the "tabs" of one test. Like the
 * real Web Locks API it grants requests one holder at a time in FIFO order, answers
 * `ifAvailable` requests with `null` while the lock is held, rejects `ifAvailable` combined with
 * `signal`, and releases the lock once the callback's promise settles. `grantDelayMs` makes the
 * browser's answer arrive late (on fake timers), for "slow but uncontended" cases.
 */
export class FakeLockManager {
  private held = false;
  private readonly queue: (() => void)[] = [];

  constructor(private readonly grantDelayMs = 0) {}

  request(name: string, options: LockOptions, callback: GrantedCallback): Promise<unknown> {
    if (options.ifAvailable && options.signal) {
      return Promise.reject(new DOMException('ifAvailable with signal', 'NotSupportedError'));
    }
    return new Promise((resolve, reject) => {
      const run = (lock: Lock | null): void => {
        Promise.resolve()
          .then(() => callback(lock))
          .then(resolve, reject)
          .finally(() => {
            if (lock) {
              this.held = false;
              this.queue.shift()?.();
            }
          });
      };
      const grant = (): void => {
        this.held = true;
        run({ name, mode: 'exclusive' } as Lock);
      };
      const decide = (): void => {
        if (!this.held) {
          grant();
        } else if (options.ifAvailable) {
          run(null);
        } else {
          this.queue.push(grant);
          options.signal?.addEventListener('abort', () => {
            const index = this.queue.indexOf(grant);
            if (index !== -1) {
              this.queue.splice(index, 1);
              reject(new DOMException('Aborted', 'AbortError'));
            }
          });
        }
      };
      if (this.grantDelayMs > 0) {
        setTimeout(decide, this.grantDelayMs);
      } else {
        decide();
      }
    });
  }

  asLockManager(): LockManager {
    return this as unknown as LockManager;
  }
}
