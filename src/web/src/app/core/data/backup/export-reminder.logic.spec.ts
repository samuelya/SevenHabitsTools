import { shouldShowExportReminder } from './export-reminder.logic';

const BASE = {
  documentCreatedAt: '2026-01-01T00:00:00.000Z',
  documentUpdatedAt: '2026-01-01T00:00:00.000Z',
  lastExportedAt: undefined,
  lastExportedDocumentUpdatedAt: undefined,
  reminderDays: 7 as const,
  now: new Date('2026-01-01T00:00:00.000Z'),
  dismissedToday: false,
  isWriter: true,
};

describe('shouldShowExportReminder', () => {
  it('is false when nothing has been edited since the document was created', () => {
    expect(shouldShowExportReminder(BASE)).toBe(false);
  });

  it('is false in a read-only tab, even if everything else says to show it', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-02-01T00:00:00.000Z',
        now: new Date('2026-03-01T00:00:00.000Z'),
        isWriter: false,
      }),
    ).toBe(false);
  });

  it('is false once dismissed today', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-02-01T00:00:00.000Z',
        now: new Date('2026-03-01T00:00:00.000Z'),
        dismissedToday: true,
      }),
    ).toBe(false);
  });

  it('is false when reminders are turned off', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-02-01T00:00:00.000Z',
        now: new Date('2026-03-01T00:00:00.000Z'),
        reminderDays: 0,
      }),
    ).toBe(false);
  });

  it('is true once reminderDays have passed since creation, edited, never exported', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-01-02T00:00:00.000Z',
        now: new Date('2026-01-08T00:00:00.000Z'), // 7 days after created
      }),
    ).toBe(true);
  });

  it('is false before reminderDays have passed since creation', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-01-02T00:00:00.000Z',
        now: new Date('2026-01-05T00:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('is false when nothing changed since the last export', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-01-02T00:00:00.000Z',
        lastExportedAt: '2026-01-03T00:00:00.000Z',
        lastExportedDocumentUpdatedAt: '2026-01-02T00:00:00.000Z',
        now: new Date('2026-03-01T00:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('is true once reminderDays have passed since the last export, and it changed again since', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-01-10T00:00:00.000Z',
        lastExportedAt: '2026-01-03T00:00:00.000Z',
        lastExportedDocumentUpdatedAt: '2026-01-03T00:00:00.000Z',
        now: new Date('2026-01-10T00:00:01.000Z'), // 7 days after the export
      }),
    ).toBe(true);
  });

  it('is false before reminderDays have passed since the last export', () => {
    expect(
      shouldShowExportReminder({
        ...BASE,
        documentUpdatedAt: '2026-01-10T00:00:00.000Z',
        lastExportedAt: '2026-01-03T00:00:00.000Z',
        lastExportedDocumentUpdatedAt: '2026-01-03T00:00:00.000Z',
        now: new Date('2026-01-09T00:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it("measures reminderDays from the export itself, not from the exported content's own prior edit time (#159)", () => {
    // Regression for #159: doc last edited 2026-08-01, exported 2026-09-16 (so
    // `lastExportedDocumentUpdatedAt` — the content watermark — is 2026-08-01, far earlier than the
    // export itself), then edited again 2026-09-17. The banner must wait `reminderDays` (7) from the
    // export (2026-09-16), not from the content's own 2026-08-01 timestamp.
    const dayAfterEdit = {
      ...BASE,
      documentUpdatedAt: '2026-09-17T00:00:00.000Z',
      lastExportedAt: '2026-09-16T00:00:00.000Z',
      lastExportedDocumentUpdatedAt: '2026-08-01T00:00:00.000Z',
    };
    expect(
      shouldShowExportReminder({ ...dayAfterEdit, now: new Date('2026-09-17T00:00:01.000Z') }),
    ).toBe(false);
    expect(
      shouldShowExportReminder({ ...dayAfterEdit, now: new Date('2026-09-23T00:00:01.000Z') }), // 7 days after the export
    ).toBe(true);
  });
});
