import { TestBed } from '@angular/core/testing';
import { LOCAL_STORAGE } from '../../browser/local-storage';
import { WEB_LOCKS } from '../../browser/web-locks';
import { FakeLocalStorage, FakeLockManager } from './multi-tab.fakes';
import { WriterLockService } from './writer-lock.service';

describe('WriterLockService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('uses the Web Locks API when navigator.locks is available', async () => {
    const manager = new FakeLockManager();
    const requestSpy = vi.spyOn(manager, 'request');
    TestBed.configureTestingModule({
      providers: [{ provide: WEB_LOCKS, useValue: manager.asLockManager() }],
    });

    const service = TestBed.inject(WriterLockService);
    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(requestSpy).toHaveBeenCalled();
    expect(service.isWriter()).toBe(true);
    expect(service.role()).toBe('writer');
    expect(service.promoted()).toBe(false);
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
