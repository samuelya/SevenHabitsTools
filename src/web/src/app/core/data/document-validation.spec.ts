import { CURRENT_SCHEMA_VERSION } from './document.model';
import { resolveDocument } from './document-validation';
import { registerModel, resetRegistryForTesting } from './registry';

function validStored(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { createdAt: 't', updatedAt: 't', appVersion: '0.0.0', deviceId: 'd' },
    profile: {},
    settings: {},
    shared: {},
    habits: {},
    extras: {},
    ...overrides,
  };
}

describe('resolveDocument', () => {
  afterEach(() => resetRegistryForTesting());

  it('accepts a document already at the current schema version and shape', () => {
    const stored = validStored();

    const result = resolveDocument(stored);

    expect(result).toEqual({ ok: true, document: stored });
  });

  it('rejects a document from a newer schema version', () => {
    const result = resolveDocument(validStored({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }));

    expect(result.ok).toBe(false);
  });

  it('rejects a document with a broken shape', () => {
    const result = resolveDocument({ schemaVersion: CURRENT_SCHEMA_VERSION });

    expect(result.ok).toBe(false);
  });

  it('rejects a document whose registered model fails its own validate()', () => {
    registerModel({
      key: 'mission',
      path: 'habits.h2.mission',
      defaults: () => ({ statement: '' }),
      validate: () => false,
    });

    const result = resolveDocument(
      validStored({ habits: { h2: { mission: 'not the right shape' } } }),
    );

    expect(result.ok).toBe(false);
  });

  it('rejects something that is not a document shape at all', () => {
    expect(resolveDocument(null).ok).toBe(false);
    expect(resolveDocument('a string').ok).toBe(false);
    expect(resolveDocument(42).ok).toBe(false);
  });
});
