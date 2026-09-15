import { HABIT_IDS } from '../habits/habits';
import { CURRENT_SCHEMA_VERSION } from './document.model';
import {
  createEmptyDocument,
  getRegisteredModels,
  registerModel,
  resetRegistryForTesting,
  validateDocument,
} from './registry';

describe('registry', () => {
  afterEach(() => {
    resetRegistryForTesting();
  });

  it('starts with no registered models', () => {
    expect(getRegisteredModels()).toEqual([]);
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
