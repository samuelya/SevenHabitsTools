import { BACKUP_MODEL_KEY, BACKUP_PATH, registerBackupModel } from './backup.model';
import {
  ModelRegistration,
  getRegisteredModels,
  resetRegistryForTesting,
  snapshotRegistryForTesting,
} from '../registry';

describe('backup model', () => {
  // Vitest here runs with `isolate: false` (shared module state across spec files), so the
  // registry is a genuinely global singleton for the whole suite: snapshot the baseline and
  // register before each test (in case an earlier file's own reset cleared it), then restore
  // exactly that baseline after — not a blind clear, which would just as easily wipe a real
  // registration (e.g. `pwa`) another spec file needs — matching `registry.spec.ts`.
  let baseline: ReadonlyMap<string, ModelRegistration>;
  beforeEach(() => {
    baseline = snapshotRegistryForTesting();
    registerBackupModel();
  });
  afterEach(() => resetRegistryForTesting(baseline));

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
