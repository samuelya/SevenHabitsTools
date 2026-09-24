import { isLive, softDelete, touch } from '../../core/data/record';
import { HabitId } from '../../core/habits/habits';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import {
  latestAssessment,
  liveAssessments,
} from '../../shared/exercise-kit/assessment-history.logic';
import {
  allMet,
  ChecklistLabels,
  ChecklistMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import {
  MATURITY_LEVELS,
  MaturityArea,
  MaturityAreaKey,
  MaturityAssessment,
  MaturityAssessmentFields,
  MaturityLevel,
} from './maturity.model';

/** Live assessments only (architecture issue #1 §6: tombstoned records are never shown). */
export function liveAssessmentsOf(
  assessments: readonly MaturityAssessment[],
): MaturityAssessment[] {
  return liveAssessments(assessments);
}

/** Started once any live assessment exists (issue #216) — the hub's "started" and the intro
 * card's collapse both read this. */
export function isStarted(assessments: readonly MaturityAssessment[]): boolean {
  return assessments.some(isLive);
}

/** The hub's in-progress text (issue #219): "1 assessment", one per live assessment; `null` with
 * none. */
export function hubStatus(assessments: readonly MaturityAssessment[]): ExerciseHubStatus | null {
  const count = liveAssessments(assessments).length;
  return count > 0 ? { key: 'habits.exercises.paradigms-maturity.assessmentCount', count } : null;
}

export function isAreaRated(area: Pick<MaturityArea, 'level'>): boolean {
  return area.level !== undefined;
}

/** An assessment is complete once it has at least one area and every area has a level (issue
 * #50's implementation notes). */
export function isAssessmentComplete(assessment: Pick<MaturityAssessment, 'areas'>): boolean {
  return assessment.areas.length > 0 && assessment.areas.every(isAreaRated);
}

/** The one gate item (issue #215). Its label says "every area in one assessment", not the
 * issue's "at least one area": #50's done rule (every area rated) is unchanged, and the checklist
 * must never claim less than the button needs. */
export const CHECKLIST_KEYS = ['rated'] as const;
export type MaturityChecklistKey = (typeof CHECKLIST_KEYS)[number];

function assessmentMet(assessment: MaturityAssessment): ChecklistMet<MaturityChecklistKey> {
  return { rated: isAssessmentComplete(assessment) };
}

function checklistMet(
  assessments: readonly MaturityAssessment[],
): ChecklistMet<MaturityChecklistKey> {
  return closestMet(liveAssessments(assessments), CHECKLIST_KEYS, assessmentMet);
}

/** Whether `DoneToggle` should be enabled: at least one live assessment is fully rated, derived
 * from the checklist (issue #215). */
export function isComplete(assessments: readonly MaturityAssessment[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(assessments));
}

/** The gate item, labelled for `DoneToggle` (see `transition.logic.ts`'s `doneChecklist()`). */
export function doneChecklist(
  assessments: readonly MaturityAssessment[],
  labels: ChecklistLabels<MaturityChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(assessments), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<MaturityChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

/** Gates the checklist's rendering until the scope has loaded (no blank rows on a cold visit). */
export function checklistLoaded(labels: ChecklistLabels<MaturityChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** Already-translated display name: a custom or renamed name if set, otherwise the built-in
 * area's translated label — never both, never neither (issue #50's implementation notes:
 * "Displayed name = name ?? t(key)"). */
export function displayName(
  area: Pick<MaturityArea, 'key' | 'name'>,
  builtInLabels: Readonly<Record<string, string>>,
): string {
  return area.name ?? (area.key ? (builtInLabels[area.key] ?? '') : '');
}

/** The level held by the most rated areas; a tie goes to the lower level (issue #50's
 * implementation notes) — `null` with no rated areas. */
export function overallProfile(areas: readonly MaturityArea[]): MaturityLevel | null {
  const rated = areas.filter(isAreaRated);
  if (rated.length === 0) {
    return null;
  }
  const counts = new Map<MaturityLevel, number>();
  for (const area of rated) {
    const level = area.level as MaturityLevel;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  let best: MaturityLevel | null = null;
  let bestCount = -1;
  // Ascending order plus a strict `>` comparison: the first level reached with the highest count
  // wins, so a tie always resolves to the lower level.
  for (const level of MATURITY_LEVELS) {
    const count = counts.get(level) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = level;
    }
  }
  return best;
}

/** Habits 1–3 for a dependence-dominant profile, 4–6 for independence, 7 for interdependence
 * (issue #50's implementation notes) — empty with no profile yet. */
export function suggestedHabits(profile: MaturityLevel | null): readonly HabitId[] {
  switch (profile) {
    case 1:
      return ['h1', 'h2', 'h3'];
    case 2:
      return ['h4', 'h5', 'h6'];
    case 3:
      return ['h7'];
    default:
      return [];
  }
}

/** Symmetric in `a`/`b`: if *either* side carries a `key`, match strictly by key equality (so a
 * renamed built-in area only matches another area with the same `key`, never a same-named custom
 * one); only when neither has a `key` does it fall back to matching by `name`. A version that
 * checked only `a`'s `key` (review finding on #49/#50's PR) let `deltaFor(a, [b])` and
 * `removedAreas([a], [b])` disagree about the very same pair, since they call this with the
 * operands in opposite order. */
function matches(
  a: Pick<MaturityArea, 'key' | 'name'>,
  b: Pick<MaturityArea, 'key' | 'name'>,
): boolean {
  if (a.key !== undefined || b.key !== undefined) {
    return a.key === b.key;
  }
  return a.name === b.name;
}

/** One area's change since `previous` — a level difference, `'new'` if it has no match in
 * `previous`, or `null` when either side isn't rated yet (issue #50's implementation notes: "Delta
 * per area against the previous assessment: level difference, or 'new'/'removed'"). Areas match by
 * `key`, else by `name`. */
export type AreaDelta =
  { readonly kind: 'diff'; readonly value: number } | { readonly kind: 'new' };

export function deltaFor(
  area: MaturityArea,
  previous: readonly MaturityArea[] | null,
): AreaDelta | null {
  if (!previous) {
    return null;
  }
  const match = previous.find((candidate) => matches(candidate, area));
  if (!match) {
    return { kind: 'new' };
  }
  if (area.level === undefined || match.level === undefined) {
    return null;
  }
  return { kind: 'diff', value: area.level - match.level };
}

/** Areas present in `previous` with no match in `current` — the "removed" half of issue #50's
 * delta requirement. */
export function removedAreas(
  current: readonly MaturityArea[],
  previous: readonly MaturityArea[] | null,
): MaturityArea[] {
  if (!previous) {
    return [];
  }
  return previous.filter((area) => !current.some((candidate) => matches(candidate, area)));
}

/** The footer's summary card: how many assessments exist and the most recent one's profile. */
export interface MaturitySummaryData {
  readonly totalAssessments: number;
  readonly latestProfile: MaturityLevel | null;
}

export function summarize(assessments: readonly MaturityAssessment[]): MaturitySummaryData {
  const live = liveAssessments(assessments);
  const latest = latestAssessment(live);
  return {
    totalAssessments: live.length,
    latestProfile: latest ? overallProfile(latest.areas) : null,
  };
}

/** A new assessment dated today, pre-filling the area list (names/keys only) from the latest
 * assessment with every level unset — none when there is no previous assessment, so the user
 * picks them as chips (issue #222; #50 pre-filled the six built-ins). */
export function newAssessmentFields(
  latest: MaturityAssessment | null,
  today: string,
): MaturityAssessmentFields {
  const areas: MaturityArea[] = latest
    ? latest.areas.map((area) => ({ id: crypto.randomUUID(), key: area.key, name: area.name }))
    : [];
  return { date: today, areas };
}

/** Draft before record (issue #217): a new assessment's draft becomes a record on the first real
 * input — an area rated, a non-blank note, or the area list itself changed (a chip chosen or
 * cleared, or a custom area added, issue #222) relative to `initial`, the draft `newAssessmentFields()` built. The areas pre-filled
 * from the latest assessment are not input, and neither is the pre-filled date. */
export function isDraftWorthSaving(
  draft: Pick<MaturityAssessment, 'areas'>,
  initial: Pick<MaturityAssessment, 'areas'>,
): boolean {
  const shape = (areas: readonly MaturityArea[]): string =>
    JSON.stringify(areas.map((area) => [area.id, area.key ?? null, area.name ?? null]));
  return (
    draft.areas.some((area) => area.level !== undefined || (area.note ?? '').trim() !== '') ||
    shape(draft.areas) !== shape(initial.areas)
  );
}

/** One chip of phase 1, "Which areas do you want to rate?" (issue #222). A suggested built-in
 * chip carries its `key` and toggles every area with that key; any other area already in the
 * assessment (a custom name, or a built-in no longer suggested such as `community`) gets a pressed
 * chip carrying its `areaId`, so an existing assessment shows every area it holds. */
export interface AreaChip {
  /** Stable `track` id: `key:<key>` for a suggested built-in, the area's own id otherwise. */
  readonly id: string;
  readonly label: string;
  readonly pressed: boolean;
  readonly key?: MaturityAreaKey;
  readonly areaId?: string;
}

export function areaChips(
  areas: readonly MaturityArea[],
  suggested: readonly MaturityAreaKey[],
  builtInLabels: Readonly<Record<string, string>>,
): AreaChip[] {
  const builtIn = suggested.map((key) => ({
    id: `key:${key}`,
    key,
    label: builtInLabels[key] ?? '',
    pressed: areas.some((area) => area.key === key),
  }));
  const others = areas
    .filter((area) => area.key === undefined || !suggested.includes(area.key))
    .map((area) => ({
      id: area.id,
      areaId: area.id,
      label: displayName(area, builtInLabels),
      pressed: true,
    }));
  return [...builtIn, ...others];
}

/** Chip toggle for a built-in area: removes every area with `key` if there is one, else appends a
 * new unrated area with that key. */
export function toggleBuiltInArea(
  areas: readonly MaturityArea[],
  key: MaturityAreaKey,
): MaturityArea[] {
  return areas.some((area) => area.key === key)
    ? areas.filter((area) => area.key !== key)
    : [...areas, { id: crypto.randomUUID(), key }];
}

/** "Add your own": appends an unrated custom area storing the trimmed `name` — `null` (nothing
 * to add) for a blank name or one a custom area already has, compared case-insensitively. */
export function addCustomArea(areas: readonly MaturityArea[], name: string): MaturityArea[] | null {
  const trimmed = name.trim();
  const folded = trimmed.toLocaleLowerCase();
  if (trimmed === '' || areas.some((area) => area.name?.trim().toLocaleLowerCase() === folded)) {
    return null;
  }
  return [...areas, { id: crypto.randomUUID(), name: trimmed }];
}

/** The two phases of the editor (issue #222): pick the areas, then rate them. */
export type MaturityFormPhase = 'areas' | 'rate';

/** Where the editor opens: a new draft, or an assessment with no areas, on the area picker; any
 * other assessment straight on rating. */
export function initialPhase(
  areas: readonly MaturityArea[],
  isNewDraft: boolean,
): MaturityFormPhase {
  return isNewDraft || areas.length === 0 ? 'areas' : 'rate';
}

/** The area to open on: the first unrated one, else the first. */
export function firstUnratedIndex(areas: readonly MaturityArea[]): number {
  const index = areas.findIndex((area) => !isAreaRated(area));
  return index === -1 ? 0 : index;
}

/** `index` kept inside `0 .. length - 1` (0 for an empty list), e.g. after the last area is
 * removed while it was the one showing. */
export function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length - 1));
}

export function setAreaLevel(
  areas: readonly MaturityArea[],
  id: string,
  level: MaturityLevel,
): MaturityArea[] {
  return areas.map((area) => (area.id === id ? { ...area, level } : area));
}

export function setAreaNote(
  areas: readonly MaturityArea[],
  id: string,
  note: string,
): MaturityArea[] {
  return areas.map((area) => (area.id === id ? { ...area, note } : area));
}

/** Removes the area `id`. Areas have no tombstone (architecture issue #1 §6 applies to records; an
 * area is a nested value object of its assessment, not a record). */
export function removeArea(areas: readonly MaturityArea[], id: string): MaturityArea[] {
  return areas.filter((area) => area.id !== id);
}

/** Replaces the fields of the live assessment `id` with `fields`, leaving every other assessment
 * alone; a no-op copy if `id` is not found or already tombstoned. */
export function editAssessment(
  assessments: readonly MaturityAssessment[],
  id: string,
  fields: Partial<MaturityAssessmentFields>,
): MaturityAssessment[] {
  return assessments.map((assessment) =>
    assessment.id === id && isLive(assessment) ? { ...assessment, ...fields } : assessment,
  );
}

/** Tombstones the assessment `id` (never removed, architecture issue #1 §6) — issue #203's shared
 * delete pattern, the same shape `removeScript()` gives `paradigms-transition`. */
export function removeAssessment(
  assessments: readonly MaturityAssessment[],
  id: string,
  now: Date,
): MaturityAssessment[] {
  return assessments.map((assessment) =>
    assessment.id === id ? softDelete(assessment, now) : assessment,
  );
}

/** Undoes `removeAssessment()`: clears the assessment `id`'s tombstone and bumps `updatedAt`
 * (issue #203's Undo snackbar). A no-op copy if `id` is not found or was never deleted. */
export function restoreAssessment(
  assessments: readonly MaturityAssessment[],
  id: string,
  now: Date,
): MaturityAssessment[] {
  return assessments.map((assessment) =>
    assessment.id === id && !isLive(assessment)
      ? touch({ ...assessment, deletedAt: undefined }, now)
      : assessment,
  );
}
