import { BACKUP_MODEL_KEY, BACKUP_PATH, registerBackupModel } from './backup.model';
import { getRegisteredModels } from '../registry';

describe('backup model', () => {
  // Vitest here runs with `isolate: false` (shared module state across spec files), so the
  // registry is a genuine global singleton for the whole suite: re-assert the registration before
  // each test in case an earlier file's own `resetRegistryForTesting()` cleared it.
  // `registerBackupModel()` is a permanent, real registration — the same category as `pwa`'s bare
  // `registerModel()` call — not a test-only fixture, so unlike `registry.spec.ts`'s own temporary
  // registrations this deliberately never "restores" the registry to a prior snapshot afterward:
  // doing so risks reverting past another model's *first* registration if it happens to occur
  // (lazily, via any import) during this file's own tests, permanently losing it for the rest of
  // the run.
  beforeEach(() => registerBackupModel());

  function registration() {
    const found = getRegisteredModels().find((model) => model.key === BACKUP_MODEL_KEY);
    if (!found) {
      throw new Error('backup model was not registered');
    }
    return found;
  }

  it('registers at settings.backup', () => {
    expect(registration().path).toBe(BACKUP_PATH);
  });

  it('defaults to a 7-day reminder with no last export yet', () => {
    expect(registration().defaults()).toEqual({ reminderDays: 7 });
  });

  it('validates a well-formed value', () => {
    expect(registration().validate?.({ reminderDays: 30 })).toBe(true);
    expect(
      registration().validate?.({ reminderDays: 1, lastExportedAt: '2026-01-01T00:00:00.000Z' }),
    ).toBe(true);
    expect(registration().validate?.({ reminderDays: 0 })).toBe(true);
  });

  it('rejects an invalid reminderDays', () => {
    expect(registration().validate?.({ reminderDays: 2 })).toBe(false);
    expect(registration().validate?.({})).toBe(false);
  });

  it('rejects a non-string lastExportedAt', () => {
    expect(registration().validate?.({ reminderDays: 7, lastExportedAt: 123 })).toBe(false);
  });

  it('rejects a non-object value', () => {
    expect(registration().validate?.(null)).toBe(false);
    expect(registration().validate?.('nope')).toBe(false);
  });
});
