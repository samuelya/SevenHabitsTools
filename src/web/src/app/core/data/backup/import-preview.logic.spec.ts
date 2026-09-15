import { buildImportPreview } from './import-preview.logic';
import { newRecord, softDelete } from '../record';
import {
  ModelRegistration,
  registerModel,
  resetRegistryForTesting,
  snapshotRegistryForTesting,
} from '../registry';
import { RootDocument } from '../document.model';

function doc(overrides: Record<string, unknown> = {}): RootDocument {
  return {
    schemaVersion: 1,
    meta: {
      createdAt: 't',
      updatedAt: '2026-01-05T00:00:00.000Z',
      appVersion: '0.0.0',
      deviceId: 'd',
    },
    profile: {},
    settings: {},
    shared: {},
    habits: {},
    extras: {},
    ...overrides,
  } as unknown as RootDocument;
}

describe('buildImportPreview', () => {
  // buildImportPreview() walks every registered model, so — unlike most specs here — these tests
  // need genuine isolation from whatever is ambiently registered (e.g. `pwa`, `backup`), not just
  // their own fixtures cleaned up: snapshot the real baseline to restore afterward (protecting
  // other specs, matching `registry.spec.ts`/`feature-store.spec.ts`), but clear to empty for the
  // duration of each test itself, so each one only ever sees what it registers.
  let baseline: ReadonlyMap<string, ModelRegistration>;
  beforeEach(() => {
    baseline = snapshotRegistryForTesting();
    resetRegistryForTesting();
  });
  afterEach(() => resetRegistryForTesting(baseline));

  it('reports the document updatedAt', () => {
    expect(buildImportPreview(doc()).updatedAt).toBe('2026-01-05T00:00:00.000Z');
  });

  it('counts live records in a collection, excluding tombstones', () => {
    registerModel({ key: 'roles', path: 'shared.roles', defaults: () => [] });
    const a = newRecord({ name: 'A' });
    const b = softDelete(newRecord({ name: 'B' }));
    const c = newRecord({ name: 'C' });

    const preview = buildImportPreview(doc({ shared: { roles: [a, b, c] } }));

    expect(preview.counts).toEqual([{ key: 'roles', count: 2 }]);
  });

  it('counts a live singleton record as 1 and a tombstoned one as 0', () => {
    registerModel({ key: 'mission', path: 'habits.h2.mission', defaults: () => ({}) });
    const live = newRecord({ statement: 'Be the change' });

    expect(buildImportPreview(doc({ habits: { h2: { mission: live } } })).counts).toEqual([
      { key: 'mission', count: 1 },
    ]);
    expect(
      buildImportPreview(doc({ habits: { h2: { mission: softDelete(live) } } })).counts,
    ).toEqual([{ key: 'mission', count: 0 }]);
  });

  it('counts a non-empty plain object as 1 and an empty one as 0', () => {
    registerModel({ key: 'prefs', path: 'settings.prefs', defaults: () => ({}) });

    expect(buildImportPreview(doc({ settings: { prefs: { theme: 'dark' } } })).counts).toEqual([
      { key: 'prefs', count: 1 },
    ]);
    expect(buildImportPreview(doc({ settings: { prefs: {} } })).counts).toEqual([
      { key: 'prefs', count: 0 },
    ]);
  });

  it('counts an absent slice as 0', () => {
    registerModel({ key: 'prefs', path: 'settings.prefs', defaults: () => ({}) });

    expect(buildImportPreview(doc()).counts).toEqual([{ key: 'prefs', count: 0 }]);
  });

  it('is empty when nothing is registered', () => {
    expect(buildImportPreview(doc()).counts).toEqual([]);
  });
});
