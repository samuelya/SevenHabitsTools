import { TestBed } from '@angular/core/testing';
import { CLOCK } from '../time/clock';
import { DocumentStore } from './document.store';
import { newRecord } from './record';

/** Configures a `DocumentStore` whose clock returns `times` in order, one per call, repeating the
 * last one once exhausted. */
function configureStore(...times: readonly string[]): DocumentStore {
  const queue = [...times];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: CLOCK,
        useValue: { now: () => new Date(queue.shift() ?? times[times.length - 1]) },
      },
    ],
  });
  return TestBed.inject(DocumentStore);
}

describe('DocumentStore', () => {
  it('starts with an empty document', () => {
    const store = configureStore('2026-01-01T00:00:00.000Z');
    expect(store.document().schemaVersion).toBeGreaterThan(0);
    expect(store.document().shared).toEqual({});
  });

  describe('select', () => {
    it('reads the value at a path and stays in sync with later writes', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      const settings = store.select<Record<string, unknown>>('settings');

      expect(settings()).toEqual({});

      store.update<Record<string, unknown>>('settings', (current) => ({
        ...current,
        theme: 'dark',
      }));

      expect(settings()).toEqual({ theme: 'dark' });
    });
  });

  describe('update', () => {
    it('applies the updater at the path and stamps meta.updatedAt', () => {
      const store = configureStore('2026-01-02T00:00:00.000Z');

      store.update<Record<string, unknown>>('settings', () => ({ theme: 'dark' }));

      expect(store.document().settings).toEqual({ theme: 'dark' });
      expect(store.document().meta.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('stamps updatedAt on the value when it looks like a record', () => {
      const store = configureStore('2026-01-02T00:00:00.000Z');
      const record = newRecord({ statement: '' }, new Date('2026-01-01T00:00:00.000Z'));
      store.replaceDocument({
        ...store.document(),
        habits: { ...store.document().habits, h2: { mission: record } },
      });

      store.update<typeof record>('habits.h2.mission', (current) => ({
        ...current,
        statement: 'Be the change',
      }));

      const mission = store.select<typeof record>('habits.h2.mission')();
      expect(mission?.statement).toBe('Be the change');
      expect(mission?.updatedAt).toBe('2026-01-02T00:00:00.000Z');
      expect(mission?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('does not mutate the previous document value', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      const before = store.document();

      store.update<Record<string, unknown>>('settings', () => ({ theme: 'dark' }));

      expect(before.settings).toEqual({});
      expect(store.document()).not.toBe(before);
    });
  });

  describe('upsertRecord', () => {
    it('inserts a new record into an empty collection', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      const record = newRecord({ name: 'Parent' });

      store.upsertRecord('shared.roles', record);

      expect(store.select<unknown[]>('shared.roles')()).toEqual([
        { ...record, updatedAt: '2026-01-01T00:00:00.000Z' },
      ]);
    });

    it('replaces the existing record with the same id instead of duplicating it', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      const record = newRecord({ name: 'Parent' });
      store.upsertRecord('shared.roles', record);

      store.upsertRecord('shared.roles', { ...record, name: 'Guardian' });

      const roles =
        store.select<{ id: string; name: string; updatedAt: string }[]>('shared.roles')();
      expect(roles).toHaveLength(1);
      expect(roles?.[0]?.name).toBe('Guardian');
      expect(roles?.[0]?.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });
  });

  describe('softDeleteRecord', () => {
    it('tombstones the matching record without removing it from the array', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      const record = newRecord({ name: 'Parent' });
      store.upsertRecord('shared.roles', record);

      store.softDeleteRecord('shared.roles', record.id);

      const roles = store.select<{ id: string; deletedAt?: string }[]>('shared.roles')();
      expect(roles).toHaveLength(1);
      expect(roles?.[0]?.deletedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('leaves records with a different id untouched', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      const a = newRecord({ name: 'A' });
      const b = newRecord({ name: 'B' });
      store.upsertRecord('shared.roles', a);
      store.upsertRecord('shared.roles', b);

      store.softDeleteRecord('shared.roles', a.id);

      const roles = store.select<{ id: string; deletedAt?: string }[]>('shared.roles')();
      expect(roles?.find((role) => role.id === b.id)?.deletedAt).toBeUndefined();
    });
  });

  describe('replaceDocument', () => {
    it('replaces the whole document', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      const next = { ...store.document(), settings: { theme: 'dark' } };

      store.replaceDocument(next);

      expect(store.document()).toBe(next);
    });
  });
});
