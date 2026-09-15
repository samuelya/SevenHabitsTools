import { RootDocument } from './document.model';
import { StorageAdapter } from './storage-adapter';

function sampleDoc(schemaVersion = 1): RootDocument {
  return {
    schemaVersion,
    meta: { createdAt: 't0', updatedAt: 't0', appVersion: '0.0.0', deviceId: 'device-1' },
    profile: {},
    settings: {},
    shared: {},
    habits: {} as RootDocument['habits'],
    extras: {},
  };
}

/**
 * Shared behaviour every `StorageAdapter` must satisfy (Liskov substitution): call this from each
 * implementation's own spec with a factory that returns a fresh adapter, so `NoopAdapter`, the
 * IndexedDB adapter (#35) and the cloud adapters later reuse one contract instead of each writing
 * (and drifting from) their own. Implementation-specific failure paths — a browser refusing to
 * open a database, a network error talking to a cloud API — belong in that adapter's own spec;
 * this contract only pins the behaviour every backend shares: the happy path, the "nothing saved
 * yet" case, and save ordering.
 */
export function describeStorageAdapterContract(createAdapter: () => StorageAdapter): void {
  describe('StorageAdapter contract', () => {
    it('resolves null when nothing has been saved', async () => {
      await expect(createAdapter().load()).resolves.toBeNull();
    });

    it('round-trips a saved document', async () => {
      const adapter = createAdapter();
      const doc = sampleDoc();

      await adapter.save(doc, { reason: 'flush' });

      await expect(adapter.load()).resolves.toEqual(doc);
    });

    it('the most recently completed save wins', async () => {
      const adapter = createAdapter();

      await adapter.save(sampleDoc(1), { reason: 'debounce' });
      await adapter.save(sampleDoc(2), { reason: 'flush' });

      await expect(adapter.load()).resolves.toEqual(sampleDoc(2));
    });

    it('serializes overlapping saves so the later call wins', async () => {
      const adapter = createAdapter();

      const first = adapter.save(sampleDoc(1), { reason: 'debounce' });
      const second = adapter.save(sampleDoc(2), { reason: 'flush' });
      await Promise.all([first, second]);

      await expect(adapter.load()).resolves.toEqual(sampleDoc(2));
    });

    it('resolves null after clear', async () => {
      const adapter = createAdapter();
      await adapter.save(sampleDoc(), { reason: 'flush' });

      await adapter.clear();

      await expect(adapter.load()).resolves.toBeNull();
    });

    it('saves and loads normally again after clear', async () => {
      const adapter = createAdapter();
      await adapter.save(sampleDoc(1), { reason: 'flush' });
      await adapter.clear();

      await adapter.save(sampleDoc(2), { reason: 'flush' });

      await expect(adapter.load()).resolves.toEqual(sampleDoc(2));
    });

    it('clear() on an adapter with nothing stored does not throw', async () => {
      await expect(createAdapter().clear()).resolves.toBeUndefined();
    });

    it('exposes a stable kind', () => {
      expect(createAdapter().kind).toBeTruthy();
    });
  });
}
