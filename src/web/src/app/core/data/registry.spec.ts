import { HABIT_IDS } from '../habits/habits';
import { CURRENT_SCHEMA_VERSION } from './document.model';
import {
  ModelRegistration,
  createEmptyDocument,
  registerModel,
  resetRegistryForTesting,
  snapshotRegistryForTesting,
  validateDocument,
} from './registry';

describe('registry', () => {
  // Real `<feature>.model.ts` files (e.g. `core/pwa/pwa.model.ts`) register themselves as a side
  // effect of being imported anywhere in the same test run; restore exactly that baseline after
  // each test here instead of wiping it, since it won't register itself again (registerModel()`'s
  // module-level call only ever runs once).
  let baseline: ReadonlyMap<string, ModelRegistration>;
  beforeEach(() => {
    baseline = snapshotRegistryForTesting();
  });
  afterEach(() => {
    resetRegistryForTesting(baseline);
  });

  it('registers a model and rejects a duplicate key', () => {
    registerModel({ key: 'mission', path: 'habits.h2.mission', defaults: () => ({}) });

    expect(() =>
      registerModel({ key: 'mission', path: 'shared.other', defaults: () => ({}) }),
    ).toThrowError(/already registered/);
  });

  it('rejects a duplicate path under a different key', () => {
    registerModel({ key: 'mission', path: 'habits.h2.mission', defaults: () => ({}) });

    expect(() =>
      registerModel({ key: 'mission-2', path: 'habits.h2.mission', defaults: () => ({}) }),
    ).toThrowError(/already registered/);
  });

  it('creates an empty document with the current schema version and root shape', () => {
    // This test is about the document's own shape, deliberately in isolation from whatever real
    // models happen to be registered elsewhere in this test run — not just whatever's in
    // `baseline` (restored again in the shared `afterEach` above).
    resetRegistryForTesting();

    const doc = createEmptyDocument();

    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(doc.meta.createdAt).toBe(doc.meta.updatedAt);
    expect(doc.meta.deviceId).toBeTruthy();
    expect(doc.profile).toEqual({});
    expect(doc.settings).toEqual({});
    expect(doc.shared).toEqual({});
    expect(doc.extras).toEqual({});
    expect(Object.keys(doc.habits)).toEqual([]);
  });

  it('composes registered defaults into the empty document at their path', () => {
    registerModel({
      key: 'mission',
      path: 'habits.h2.mission',
      defaults: () => ({ statement: '' }),
    });
    registerModel({ key: 'roles', path: 'shared.roles', defaults: () => [] });

    const doc = createEmptyDocument();

    expect(doc.habits['h2']?.['mission']).toEqual({ statement: '' });
    expect(doc.shared['roles']).toEqual([]);
    expect(HABIT_IDS).toContain('h2');
  });

  it('validates each registered model slice independently', () => {
    registerModel({
      key: 'mission',
      path: 'habits.h2.mission',
      defaults: () => ({ statement: '' }),
      validate: (value) => typeof value === 'object' && value !== null,
    });

    const doc = createEmptyDocument();
    expect(validateDocument(doc as unknown as Record<string, unknown>)).toEqual([]);

    doc.habits['h2']!['mission'] = 'not an object';
    expect(validateDocument(doc as unknown as Record<string, unknown>)).toEqual([
      { path: 'habits.h2.mission', message: 'data.validation.invalidModel' },
    ]);
  });

  it('does not flag a slice that has not been populated yet', () => {
    registerModel({
      key: 'mission',
      path: 'habits.h2.mission',
      defaults: () => ({ statement: '' }),
      validate: () => false,
    });

    expect(validateDocument({ schemaVersion: 1 })).toEqual([]);
  });

  it('preserves unknown keys when validating', () => {
    const doc = { schemaVersion: 1, futureFeature: { untouched: true } };
    validateDocument(doc);
    expect(doc).toEqual({ schemaVersion: 1, futureFeature: { untouched: true } });
  });
});
