import { TestBed } from '@angular/core/testing';
import { LOCAL_STORAGE, LocalStorageLike } from '../../browser/local-storage';
import { WEB_LOCKS } from '../../browser/web-locks';
import { WriterLockService } from './writer-lock.service';

class FakeLocalStorage implements LocalStorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('WriterLockService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('uses the Web Locks API when navigator.locks is available', async () => {
    const request = vi.fn(
      (_name: string, _options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) =>
        callback(null),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: WEB_LOCKS, useValue: { request } as unknown as LockManager }],
    });

    const service = TestBed.inject(WriterLockService);
    service.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(request).toHaveBeenCalled();
    expect(service.isWriter()).toBe(true);
  });

  it('falls back to the localStorage heartbeat when navigator.locks is unavailable', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: WEB_LOCKS, useValue: undefined },
        { provide: LOCAL_STORAGE, useValue: new FakeLocalStorage() },
      ],
    });

    const service = TestBed.inject(WriterLockService);
    service.start();
    await vi.advanceTimersByTimeAsync(100);

    expect(service.isWriter()).toBe(true);
  });

  it('ngOnDestroy() stops the underlying strategy', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: WEB_LOCKS, useValue: undefined },
        { provide: LOCAL_STORAGE, useValue: new FakeLocalStorage() },
      ],
    });
    const service = TestBed.inject(WriterLockService);
    service.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(service.isWriter()).toBe(true);

    service.ngOnDestroy();

    expect(service.isWriter()).toBe(false);
  });
});
