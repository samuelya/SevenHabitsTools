import { getRegisteredModels, registerModel } from '../registry';

/** `0` turns the "export your data" reminder off; otherwise the number of days since the last
 * export (or since the document was created, if it was never exported) before the banner shows. */
export type ReminderDays = 0 | 1 | 7 | 30;

export interface BackupSettings {
  readonly lastExportedAt?: string;
  readonly reminderDays: ReminderDays;
}

const VALID_REMINDER_DAYS: readonly ReminderDays[] = [0, 1, 7, 30];

function isBackupSettings(value: unknown): value is BackupSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate['lastExportedAt'] !== undefined &&
    typeof candidate['lastExportedAt'] !== 'string'
  ) {
    return false;
  }
  return (VALID_REMINDER_DAYS as readonly unknown[]).includes(candidate['reminderDays']);
}

/** The model key `featureStore<BackupSettings>()` callers resolve. */
export const BACKUP_MODEL_KEY = 'backup';

/** The document path this model lives at, exported for the one caller (`DocumentImportExportService`)
 * that has to bypass `featureStore`'s `update()` for `lastExportedAt` (#152) and write through
 * `DocumentStore.replaceDocument()`/`document-path.utils.ts` directly instead. */
export const BACKUP_PATH = 'settings.backup';

/**
 * Registers the `backup` model, a no-op if it already is. The module bottom calls this once at
 * load, the normal way every `<feature>.model.ts` registers itself (`registry.ts`); it is also
 * exported so a spec file that needs `settings.backup` resolvable can call it again in its own
 * `beforeEach` — this project's unit tests run with Vitest `isolate: false` (Karma-like, shared
 * module state across files), so another spec's `resetRegistryForTesting()` can otherwise empty
 * the registry between this module's one-time load and a later file's tests.
 */
export function registerBackupModel(): void {
  if (getRegisteredModels().some((model) => model.key === BACKUP_MODEL_KEY)) {
    return;
  }
  registerModel<BackupSettings>({
    key: BACKUP_MODEL_KEY,
    path: BACKUP_PATH,
    defaults: () => ({ reminderDays: 7 }),
    validate: isBackupSettings,
  });
}

registerBackupModel();
