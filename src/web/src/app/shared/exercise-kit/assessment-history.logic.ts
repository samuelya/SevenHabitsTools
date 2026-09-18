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
  readonly deletedAt?: string;
}

/** Live (non-tombstoned) assessments only (architecture issue #1 §6). */
export function liveAssessments<T extends DatedAssessment>(assessments: readonly T[]): T[] {
  return assessments.filter((assessment) => assessment.deletedAt === undefined);
}

/** Newest first; same-day entries break ties by `id` so the order is stable across calls. */
export function sortedByDateDesc<T extends DatedAssessment>(assessments: readonly T[]): T[] {
  return [...assessments].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
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
