/**
 * Shared pure helpers for the **assessment** exercise type (playbook §4): a repeatable, dated
 * record compared over time. Created by the first assessment PR (#49/#50) so every later
 * assessment reuses one implementation of "newest first" and "latest vs previous" instead of
 * copying it per feature.
 */

/** The minimal shape these helpers need — every assessment record (`PcAudit`,
 * `MaturityAssessment`, …) already has it through `BaseRecord` plus its own `date` field. */
export interface DatedAssessment {
  readonly id: string;
  readonly date: string;
  readonly createdAt: string;
  readonly deletedAt?: string;
}

/** Live (non-tombstoned) assessments only (architecture issue #1 §6). */
export function liveAssessments<T extends DatedAssessment>(assessments: readonly T[]): T[] {
  return assessments.filter((assessment) => assessment.deletedAt === undefined);
}

/** Newest first; same-day entries break ties by `createdAt`, not `id` — ids are random UUIDs
 * unrelated to creation order, so tie-breaking on them picked an arbitrary "latest" among
 * same-day records instead of the one actually created last (review finding on #49/#50's PR). */
export function sortedByDateDesc<T extends DatedAssessment>(assessments: readonly T[]): T[] {
  return [...assessments].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** The most recent live assessment, `null` with none — used to pre-fill a new one. */
export function latestAssessment<T extends DatedAssessment>(assessments: readonly T[]): T | null {
  return sortedByDateDesc(liveAssessments(assessments))[0] ?? null;
}

/** The live assessment immediately before `id` in date order — `null` for the earliest one, or an
 * `id` that isn't live. Works for any selected assessment, not only the latest one, so a page can
 * compare whichever one the user has open against the one before it. */
export function previousAssessment<T extends DatedAssessment>(
  assessments: readonly T[],
  id: string,
): T | null {
  const sorted = sortedByDateDesc(liveAssessments(assessments));
  const index = sorted.findIndex((assessment) => assessment.id === id);
  return index === -1 ? null : (sorted[index + 1] ?? null);
}

/** Parses a user-entered `YYYY-MM-DD` date-only string as local midnight, not UTC midnight —
 * `new Date('YYYY-MM-DD')` is parsed as UTC (the ECMAScript date-string form), which shifts the
 * displayed calendar date back a day once formatted through `AppDatePipe` in a negative UTC-offset
 * timezone. A date the user typed has no time zone of its own, so "local midnight" is the one
 * reading that always round-trips back to the same calendar date. */
export function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** The local calendar date (`YYYY-MM-DD`) `now` falls on — same convention as
 * `core/data/backup/export-reminder-dismissal.ts`'s own `localDateString()`. A new audit/
 * assessment must be dated by the browser's local day, not `now.toISOString().slice(0, 10)`'s UTC
 * day: every reader of this string (`parseIsoDate` above) treats it as local midnight, so stamping
 * it with the UTC day instead mis-dates a record created near a day boundary in any non-UTC
 * timezone (review finding on #49/#50's PR). */
export function localDateString(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whether `value` is a real calendar date in `YYYY-MM-DD` form — the only value an editable
 * assessment date (issue #226) may store, and the one a history row can format (anything else,
 * such as an imported `''` or `2026-13-01`, is titled "No date"). The pattern alone lets an
 * impossible date through (`2026-13-01` parses to Invalid Date, which `AppDatePipe` renders as an
 * empty string), and a `NaN` check isn't enough either: `2026-02-30` rolls over to 2 March
 * (#224). So the value must round-trip through `parseIsoDate` → `localDateString` unchanged. A
 * native `<input type="date">` emits `''` when cleared, which fails here too. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = parseIsoDate(value);
  return !isNaN(date.getTime()) && localDateString(date) === value;
}

/** A history row's result summary (issue #226), as a translation key rather than text so the row
 * follows a language switch: resolved through `appPlural` with `count` when it has one ("2
 * over-used"), else through `transloco` ("Mostly independence"). */
export interface AssessmentResultSummary {
  readonly key: string;
  readonly count?: number;
}

/** One history row: the assessment's raw `YYYY-MM-DD` date (formatted by the list through
 * `AppDatePipe`) plus its result summary, absent while the assessment has no result yet. */
export interface AssessmentHistoryItem {
  readonly id: string;
  readonly date: string;
  /** An already-translated row title (issue #58: the long view's scenario). With one, the date
   * moves to the row's second line, before the summary. */
  readonly label?: string;
  readonly summary?: AssessmentResultSummary;
}

/** The "date + summary" rows every assessment's history shows (issue #226): one per entry of
 * `history`, in its order, each labelled by the exercise's own result rule `summaryOf`. `history`
 * is the page's own already-ordered list (live, `sortedByDateDesc`), so the rows and the "latest"
 * the page copies from never disagree, and the list isn't filtered and sorted twice. */
export function assessmentHistoryItems<T extends DatedAssessment>(
  history: readonly T[],
  summaryOf: (assessment: T) => AssessmentResultSummary | null,
): AssessmentHistoryItem[] {
  return history.map((assessment) => {
    const summary = summaryOf(assessment);
    return summary === null
      ? { id: assessment.id, date: assessment.date }
      : { id: assessment.id, date: assessment.date, summary };
  });
}
