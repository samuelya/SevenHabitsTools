import { ReminderDays } from './backup.model';

export interface ExportReminderInput {
  readonly documentCreatedAt: string;
  readonly documentUpdatedAt: string;
  /** Wall-clock time of the last export — the reminder-interval anchor. Never compared against
   * `documentUpdatedAt` to detect a content change; that's `lastExportedDocumentUpdatedAt` (#159:
   * the two drift apart when a document is exported long after its last edit). */
  readonly lastExportedAt: string | undefined;
  /** The exported snapshot's own `meta.updatedAt` as of the last export — used only to detect
   * whether the document has changed since. */
  readonly lastExportedDocumentUpdatedAt: string | undefined;
  readonly reminderDays: ReminderDays;
  readonly now: Date;
  /** Whether the user already dismissed the banner today (#37: "dismissable for the day" —
   * `ExportReminderDismissal`). */
  readonly dismissedToday: boolean;
  readonly isWriter: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whether the "export your data" reminder banner should show on Home. Never for a read-only tab
 * (it can't have caused any unsaved changes, and nagging it to export is someone else's tab's
 * business) or once already dismissed today, and never when reminders are off (`reminderDays ===
 * 0`). Otherwise: if nothing has been edited since the document was created, there is nothing to
 * back up yet; if something has been edited since the last export (or there has never been one),
 * the reminder is due once `reminderDays` have passed since that last export happened — or since
 * the document was created, for a document that has never been exported at all.
 */
export function shouldShowExportReminder(input: ExportReminderInput): boolean {
  if (!input.isWriter || input.dismissedToday || input.reminderDays === 0) {
    return false;
  }
  if (input.documentUpdatedAt <= input.documentCreatedAt) {
    return false;
  }
  if (
    input.lastExportedDocumentUpdatedAt !== undefined &&
    input.documentUpdatedAt <= input.lastExportedDocumentUpdatedAt
  ) {
    return false;
  }
  const since = input.lastExportedAt ?? input.documentCreatedAt;
  const dueAt = new Date(since).getTime() + input.reminderDays * MS_PER_DAY;
  return input.now.getTime() >= dueAt;
}
