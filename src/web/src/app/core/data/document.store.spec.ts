import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLOCK } from '../time/clock';
import { DocumentStore } from './document.store';
import { WRITER_LOCK } from './multi-tab/writer-lock';
import { WriterRole } from './multi-tab/writer-role-state';
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
      // Not necessarily {}: registered models (registry.ts) may contribute their own defaults
      // under `settings`, e.g. `settings.pwa` (#27) — this test only cares that a write merges
      // onto whatever was already there.
      const initial = settings();

      store.update<Record<string, unknown>>('settings', (current) => ({
        ...current,
        theme: 'dark',
      }));

      expect(settings()).toEqual({ ...initial, theme: 'dark' });
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
      const initialSettings = before.settings;

      store.update<Record<string, unknown>>('settings', () => ({ theme: 'dark' }));

      expect(before.settings).toEqual(initialSettings);
      expect(store.document()).not.toBe(before);
    });

    it('stamps the nearest enclosing record when updating a field inside it', () => {
      const store = configureStore('2026-01-02T00:00:00.000Z');
      const record = newRecord({ statement: '' }, new Date('2026-01-01T00:00:00.000Z'));
      store.replaceDocument({
        ...store.document(),
        habits: { ...store.document().habits, h2: { mission: record } },
      });

      store.update<string>('habits.h2.mission.statement', () => 'Be the change');

      const mission = store.select<typeof record & { statement: string }>('habits.h2.mission')();
      expect(mission?.statement).toBe('Be the change');
      expect(mission?.updatedAt).toBe('2026-01-02T00:00:00.000Z');
      expect(mission?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('stamps only the changed record when update() maps over a whole collection', () => {
      const store = configureStore('2026-01-02T00:00:00.000Z');
      const a = newRecord({ name: 'A' }, new Date('2026-01-01T00:00:00.000Z'));
      const b = newRecord({ name: 'B' }, new Date('2026-01-01T00:00:00.000Z'));
      store.replaceDocument({ ...store.document(), shared: { roles: [a, b] } });

      store.update<(typeof a)[]>('shared.roles', (roles) =>
        roles.map((role) => (role.id === a.id ? { ...role, name: 'A2' } : role)),
      );

      const roles =
        store.select<{ id: string; name: string; updatedAt: string }[]>('shared.roles')();
      expect(roles?.find((role) => role.id === a.id)?.updatedAt).toBe('2026-01-02T00:00:00.000Z');
      expect(roles?.find((role) => role.id === b.id)?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('is a no-op, touching neither the document nor meta.updatedAt, when the updater returns the same value', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      store.update<Record<string, unknown>>('settings', () => ({ theme: 'dark' }));
      const before = store.document();

      const result = store.update<Record<string, unknown>>('settings', (current) => current);

      expect(result).toBe(true);
      expect(store.document()).toBe(before);
      expect(store.document().meta.updatedAt).toBe('2026-01-01T00:00:00.000Z');
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

    it('keeps the stored createdAt, ignoring a caller-supplied one', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      const record = newRecord({ name: 'Parent' }, new Date('2026-01-01T00:00:00.000Z'));
      store.upsertRecord('shared.roles', record);

      store.upsertRecord('shared.roles', {
        ...record,
        name: 'Guardian',
        createdAt: '2099-01-01T00:00:00.000Z',
      });

      const roles = store.select<{ id: string; createdAt: string }[]>('shared.roles')();
      expect(roles?.[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('throws instead of reviving a tombstoned record', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      const record = newRecord({ name: 'Parent' });
      store.upsertRecord('shared.roles', record);
      store.softDeleteRecord('shared.roles', record.id);

      expect(() => store.upsertRecord('shared.roles', { ...record, name: 'Revived' })).toThrow(
        /tombstoned/,
      );
    });

    it('throws a descriptive error instead of a raw TypeError when the path is not an array', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      store.update<Record<string, unknown>>('settings', () => ({ theme: 'dark' }));

      expect(() => store.upsertRecord('settings', newRecord({ name: 'x' }))).toThrow(
        /"settings".*not an array/,
      );
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

    it('is a no-op, keeping the original tombstone time, on an already-tombstoned record', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      const record = newRecord({ name: 'Parent' });
      store.upsertRecord('shared.roles', record);
      store.softDeleteRecord('shared.roles', record.id);
      const before = store.document();

      const result = store.softDeleteRecord('shared.roles', record.id);

      expect(result).toBe(true);
      expect(store.document()).toBe(before);
      const roles = store.select<{ id: string; deletedAt?: string }[]>('shared.roles')();
      expect(roles?.[0]?.deletedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('is a no-op when the id is not in the collection', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      store.upsertRecord('shared.roles', newRecord({ name: 'Parent' }));
      const before = store.document();

      const result = store.softDeleteRecord('shared.roles', 'missing-id');

      expect(result).toBe(true);
      expect(store.document()).toBe(before);
    });

    it('throws a descriptive error instead of silently creating a collection when the path holds no array', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');

      expect(() => store.softDeleteRecord('shared.roles', 'any-id')).toThrow(
        /"shared\.roles".*not an array/,
      );
      expect(store.document().shared).toEqual({});
    });

    it('throws a descriptive error instead of a raw TypeError when the path is not an array', () => {
      const store = configureStore('2026-01-01T00:00:00.000Z');
      store.update<Record<string, unknown>>('settings', () => ({ theme: 'dark' }));

      expect(() => store.softDeleteRecord('settings', 'any-id')).toThrow(
        /"settings".*not an array/,
      );
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

  describe('#127: edits while this tab is not the writer', () => {
    function configureWithRole(role: WriterRole): DocumentStore {
      const roleSignal = signal(role);
      TestBed.configureTestingModule({
        providers: [
          {
            provide: WRITER_LOCK,
            useValue: { role: roleSignal, isWriter: signal(role === 'writer') },
          },
        ],
      });
      return TestBed.inject(DocumentStore);
    }

    for (const role of ['reader', 'pending'] as const) {
      it(`refuses update, upsertRecord and softDeleteRecord while ${role}, leaving the document untouched`, () => {
        const store = configureWithRole(role);
        const before = store.document();

        expect(store.update('settings', () => ({ theme: 'dark' }))).toBe(false);
        expect(store.upsertRecord('shared.roles', newRecord({ name: 'x' }, new Date()))).toBe(
          false,
        );
        expect(store.softDeleteRecord('shared.roles', 'missing')).toBe(false);

        expect(store.document()).toBe(before);
        expect(store.refusedEdits()).toBe(3);
      });
    }

    it('accepts edits, and counts nothing, as the writer', () => {
      const store = configureWithRole('writer');

      expect(store.update('settings', () => ({ theme: 'dark' }))).toBe(true);

      expect(store.document().settings).toEqual({ theme: 'dark' });
      expect(store.refusedEdits()).toBe(0);
    });

    it('isWriter() only answers; reportRefusedEdit() counts a refusal (issue #217)', () => {
      const writer = configureWithRole('writer');
      expect(writer.isWriter()).toBe(true);

      TestBed.resetTestingModule();
      const reader = configureWithRole('reader');
      const before = reader.document();
      expect(reader.isWriter()).toBe(false);
      expect(reader.refusedEdits()).toBe(0);
      reader.reportRefusedEdit();
      expect(reader.refusedEdits()).toBe(1);
      expect(reader.document()).toBe(before);
    });

    it('still lets replaceDocument through, since it is not an edit', () => {
      const store = configureWithRole('reader');
      const next = { ...store.document(), settings: { theme: 'from-writer' } };

      store.replaceDocument(next);

      expect(store.document()).toBe(next);
      expect(store.refusedEdits()).toBe(0);
    });
  });
});
