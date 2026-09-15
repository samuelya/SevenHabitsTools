import { TestBed } from '@angular/core/testing';
import { NAVIGATOR_STORAGE } from '../browser/storage-manager';
import { StoragePersistenceService } from './storage-persistence.service';

function setUp(storageManager?: Partial<StorageManager>): StoragePersistenceService {
  TestBed.configureTestingModule({
    providers: [{ provide: NAVIGATOR_STORAGE, useValue: storageManager }],
  });
  return TestBed.inject(StoragePersistenceService);
}

describe('StoragePersistenceService', () => {
  it('is a no-op in browsers without the Storage Manager API', async () => {
    const service = setUp(undefined);

    await service.requestPersistence();

    expect(service.persisted()).toBeNull();
    expect(service.estimate()).toBeNull();
  });

  it('reports persisted true and the usage/quota estimate on success', async () => {
    const service = setUp({
      persist: vi.fn().mockResolvedValue(true),
      estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 1024 * 1024 }),
    });

    await service.requestPersistence();

    expect(service.persisted()).toBe(true);
    expect(service.estimate()).toEqual({ usageBytes: 1024, quotaBytes: 1024 * 1024 });
  });

  it('reports persisted false when the browser declines the request', async () => {
    const service = setUp({
      persist: vi.fn().mockResolvedValue(false),
      estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
    });

    await service.requestPersistence();

    expect(service.persisted()).toBe(false);
  });

  it('reports persisted false, not an error, when persist() rejects', async () => {
    const service = setUp({
      persist: vi.fn().mockRejectedValue(new Error('denied')),
      estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
    });

    await expect(service.requestPersistence()).resolves.toBeUndefined();

    expect(service.persisted()).toBe(false);
  });

  it('leaves the estimate as null when estimate() rejects', async () => {
    const service = setUp({
      persist: vi.fn().mockResolvedValue(true),
      estimate: vi.fn().mockRejectedValue(new Error('unavailable')),
    });

    await expect(service.requestPersistence()).resolves.toBeUndefined();

    expect(service.estimate()).toBeNull();
  });
});
