import { DocumentBootstrapStatus } from './document-bootstrap-status';
import { runDocumentBootstrap } from './document-bootstrap';
import { CURRENT_SCHEMA_VERSION, RootDocument } from './document.model';
import { DocumentStore } from './document.store';
import { registerModel, resetRegistryForTesting } from './registry';
import { StorageAdapter } from './storage-adapter';

function fakeAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    kind: 'noop',
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeStore(): DocumentStore & { replaceDocument: ReturnType<typeof vi.fn> } {
  return { replaceDocument: vi.fn() } as unknown as DocumentStore & {
    replaceDocument: ReturnType<typeof vi.fn>;
  };
}

function fakeStatus(): DocumentBootstrapStatus & {
  reportReady: ReturnType<typeof vi.fn>;
  reportCorrupt: ReturnType<typeof vi.fn>;
} {
  return { reportReady: vi.fn(), reportCorrupt: vi.fn() } as unknown as DocumentBootstrapStatus & {
    reportReady: ReturnType<typeof vi.fn>;
    reportCorrupt: ReturnType<typeof vi.fn>;
  };
}

const deviceIdSource = { id: () => 'device-1' };

describe('runDocumentBootstrap', () => {
  it('creates an empty document with the injected device id when nothing was saved', async () => {
    const store = fakeStore();
    const status = fakeStatus();

    await runDocumentBootstrap({ adapter: fakeAdapter(), deviceIdSource, store, status });

    expect(store.replaceDocument).toHaveBeenCalledTimes(1);
    const doc = store.replaceDocument.mock.calls[0][0] as RootDocument;
    expect(doc.meta.deviceId).toBe('device-1');
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(status.reportReady).toHaveBeenCalledTimes(1);
  });

  it('migrates and loads a stored document', async () => {
    const store = fakeStore();
    const status = fakeStatus();
    const stored = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      meta: { createdAt: 't', updatedAt: 't', appVersion: '0.0.0', deviceId: 'device-2' },
      profile: {},
      settings: {},
      shared: {},
      habits: {},
      extras: {},
    } as unknown as RootDocument;

    await runDocumentBootstrap({
      adapter: fakeAdapter({ load: vi.fn().mockResolvedValue(stored) }),
      deviceIdSource,
      store,
      status,
    });

    expect(store.replaceDocument).toHaveBeenCalledWith(stored);
    expect(status.reportReady).toHaveBeenCalledTimes(1);
  });

  it('reports corrupt when the adapter fails to load', async () => {
    const store = fakeStore();
    const status = fakeStatus();
    const error = new Error('boom');

    await runDocumentBootstrap({
      adapter: fakeAdapter({ load: vi.fn().mockRejectedValue(error) }),
      deviceIdSource,
      store,
      status,
    });

    expect(store.replaceDocument).not.toHaveBeenCalled();
    expect(status.reportCorrupt).toHaveBeenCalledWith(null, error);
  });

  it('reports corrupt (keeping the raw data) when migration fails', async () => {
    const store = fakeStore();
    const status = fakeStatus();
    const stored = { schemaVersion: CURRENT_SCHEMA_VERSION + 1 } as unknown as RootDocument;

    await runDocumentBootstrap({
      adapter: fakeAdapter({ load: vi.fn().mockResolvedValue(stored) }),
      deviceIdSource,
      store,
      status,
    });

    expect(store.replaceDocument).not.toHaveBeenCalled();
    expect(status.reportCorrupt).toHaveBeenCalledWith(stored, expect.any(Error));
  });

  describe('a document at the current schema version with a broken shape', () => {
    afterEach(() => resetRegistryForTesting());

    it.each([
      ['missing everything but schemaVersion', { schemaVersion: CURRENT_SCHEMA_VERSION }],
      [
        'habits not an object',
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          meta: { createdAt: 't', updatedAt: 't', appVersion: '0.0.0', deviceId: 'd' },
          profile: {},
          settings: {},
          shared: {},
          habits: 'oops',
          extras: {},
        },
      ],
      [
        'meta is null',
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          meta: null,
          profile: {},
          settings: {},
          shared: {},
          habits: {},
          extras: {},
        },
      ],
    ])('reports corrupt for %s instead of loading it as ready', async (_label, stored) => {
      const store = fakeStore();
      const status = fakeStatus();

      await runDocumentBootstrap({
        adapter: fakeAdapter({ load: vi.fn().mockResolvedValue(stored) }),
        deviceIdSource,
        store,
        status,
      });

      expect(store.replaceDocument).not.toHaveBeenCalled();
      expect(status.reportCorrupt).toHaveBeenCalledWith(stored, expect.any(Error));
    });

    it('reports corrupt when a registered model fails its own validate()', async () => {
      registerModel({
        key: 'mission',
        path: 'habits.h2.mission',
        defaults: () => ({ statement: '' }),
        validate: () => false,
      });
      const store = fakeStore();
      const status = fakeStatus();
      const stored = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        meta: { createdAt: 't', updatedAt: 't', appVersion: '0.0.0', deviceId: 'd' },
        profile: {},
        settings: {},
        shared: {},
        habits: { h2: { mission: 'not the right shape' } },
        extras: {},
      };

      await runDocumentBootstrap({
        adapter: fakeAdapter({ load: vi.fn().mockResolvedValue(stored) }),
        deviceIdSource,
        store,
        status,
      });

      expect(store.replaceDocument).not.toHaveBeenCalled();
      expect(status.reportCorrupt).toHaveBeenCalledWith(stored, expect.any(Error));
    });
  });
});
