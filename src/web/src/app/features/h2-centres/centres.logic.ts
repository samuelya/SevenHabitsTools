import { isLive, softDelete, touch } from '../../core/data/record';
import {
  ChecklistLabels,
  ChecklistMet,
  allMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import {
  latestAssessment,
  type AssessmentHistoryItem,
} from '../../shared/exercise-kit/assessment-history.logic';
import type { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import type {
  CentreAssessment,
  CentreAssessmentFields,
  CentreKey,
  CentrePrinciple,
  CentreRating,
  FactorKey,
  PrincipleKey,
} from './centres.model';

/** The ten centres (issue #60), in card order. Stored as a key and translated at render. Defined
 * here, not in the model, so this file imports only types from it (no import cycle). */
export const CENTRE_KEYS = [
  'partner',
  'family',
  'money',
  'work',
  'possessions',
  'pleasure',
  'friends',
  'enemies',
  'religion',
  'self',
] as const;

/** The twelve suggested principles, labelled through `exerciseKit.principle.*` (#61 reads them
 * too). */
export const PRINCIPLE_KEYS = [
  'fairness',
  'honesty',
  'integrity',
  'dignity',
  'service',
  'excellence',
  'growth',
  'patience',
  'courage',
  'kindness',
  'responsibility',
  'gratitude',
] as const;

/** "Not me / A little / Quite a lot / This is me". */
export const RATINGS = [0, 1, 2, 3] as const;

/** The four factors asked about the top centre. */
export const FACTOR_KEYS = ['security', 'guidance', 'wisdom', 'power'] as const;

/** The top of the scale: the "of 3" in "Work: 3 of 3". */
export const MAX_RATING = 3;

/** "Five is enough to live by." */
export const MAX_PRINCIPLES = 5;

const hasText = (value: string | undefined): boolean => (value ?? '').trim() !== '';

/** A new assessment dated `date`: nothing rated, no factors, no principles. */
export function newAssessmentFields(date: string): CentreAssessmentFields {
  return { date, ratings: {}, principles: [] };
}

/** `centre`'s rating, 0 when unrated; an imported value outside 0–3 is clamped to it. */
export function ratingOf(assessment: CentreAssessment, centre: CentreKey): CentreRating {
  const rating = assessment.ratings[centre];
  if (typeof rating !== 'number' || !Number.isFinite(rating)) {
    return 0;
  }
  return Math.min(MAX_RATING, Math.max(0, Math.round(rating))) as CentreRating;
}

export interface RankedCentre {
  readonly centre: CentreKey;
  readonly rating: CentreRating;
}

/** Every centre by rating, highest first; ties keep card order. */
export function ranked(assessment: CentreAssessment): readonly RankedCentre[] {
  return CENTRE_KEYS.map((centre) => ({ centre, rating: ratingOf(assessment, centre) })).sort(
    (a, b) => b.rating - a.rating,
  );
}

/** The highest-rated centre (ties: the first in card order), `null` when every rating is 0. */
export function topCentre(assessment: CentreAssessment): CentreKey | null {
  const [top] = ranked(assessment);
  return top.rating > 0 ? top.centre : null;
}

/** `assessment`'s ratings with `centre` set to `rating`. */
export function withRating(
  assessment: CentreAssessment,
  centre: CentreKey,
  rating: CentreRating,
): CentreAssessment['ratings'] {
  return { ...assessment.ratings, [centre]: rating };
}

/** `assessment`'s factors with `factor` set to `text`. */
export function withFactor(
  assessment: CentreAssessment,
  factor: FactorKey,
  text: string,
): NonNullable<CentreAssessment['factors']> {
  return { ...assessment.factors, [factor]: text };
}

/** Principles with exactly one of `key`/`name` set; anything else an import may hold is ignored. */
export function validPrinciples(assessment: CentreAssessment): readonly CentrePrinciple[] {
  return assessment.principles.filter(
    (principle) => (principle.key !== undefined) !== hasText(principle.name),
  );
}

export function hasPrincipleKey(
  principles: readonly CentrePrinciple[],
  key: PrincipleKey,
): boolean {
  return principles.some((principle) => principle.key === key);
}

/** Adds the suggested `key`, or `null` when five are already chosen (the refusal). */
export function addPrincipleKey(
  principles: readonly CentrePrinciple[],
  key: PrincipleKey,
): readonly CentrePrinciple[] | null {
  if (hasPrincipleKey(principles, key)) {
    return principles;
  }
  return principles.length >= MAX_PRINCIPLES ? null : [...principles, { key }];
}

export function removePrinciple(
  principles: readonly CentrePrinciple[],
  principle: CentrePrinciple,
): readonly CentrePrinciple[] {
  return principles.filter((existing) =>
    principle.key !== undefined ? existing.key !== principle.key : existing.name !== principle.name,
  );
}

/** What adding typed text does: the new list, or why it was refused (the text then stays). */
export type AddNameResult =
  { readonly principles: readonly CentrePrinciple[] } | { readonly refused: 'max' };

/**
 * Adds the user's own words (trimmed). Words matching a suggestion's label (case-insensitive)
 * select that suggestion's key instead; words already chosen change nothing. A sixth principle is
 * refused.
 */
export function addPrincipleName(
  principles: readonly CentrePrinciple[],
  name: string,
  keyLabels: Readonly<Record<PrincipleKey, string>>,
): AddNameResult {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { principles };
  }
  const same = (text: string) => text.trim().toLowerCase() === trimmed.toLowerCase();
  const key = (Object.keys(keyLabels) as PrincipleKey[]).find((candidate) =>
    same(keyLabels[candidate]),
  );
  const already = principles.some((principle) =>
    principle.key !== undefined ? principle.key === key : same(principle.name ?? ''),
  );
  if (already) {
    return { principles };
  }
  if (principles.length >= MAX_PRINCIPLES) {
    return { refused: 'max' };
  }
  return { principles: [...principles, key !== undefined ? { key } : { name: trimmed }] };
}

/** A principle's label: a suggestion translated, the user's own words as typed. */
export function principleLabel(
  principle: CentrePrinciple,
  keyLabels: Readonly<Record<PrincipleKey, string>>,
): string {
  return principle.key !== undefined ? (keyLabels[principle.key] ?? '') : (principle.name ?? '');
}

export function principleLabels(
  assessment: CentreAssessment,
  keyLabels: Readonly<Record<PrincipleKey, string>>,
): readonly string[] {
  return validPrinciples(assessment).map((principle) => principleLabel(principle, keyLabels));
}

/** Draft before record (issue #217): a rating choice (issue #60's deviation), typed factor text
 * or a principle. */
export function isDraftWorthSaving(assessment: CentreAssessment): boolean {
  return (
    Object.values(assessment.ratings).some((rating) => rating !== undefined) ||
    FACTOR_KEYS.some((factor) => hasText(assessment.factors?.[factor])) ||
    assessment.principles.length > 0
  );
}

/** The three gate items (issue #60), in the order the user meets them. */
export const CHECKLIST_KEYS = ['ratings', 'factors', 'principle'] as const;
export type CentresChecklistKey = (typeof CHECKLIST_KEYS)[number];

function checklistMet(assessment: CentreAssessment): ChecklistMet<CentresChecklistKey> {
  return {
    ratings: topCentre(assessment) !== null,
    factors:
      topCentre(assessment) !== null &&
      FACTOR_KEYS.every((factor) => hasText(assessment.factors?.[factor])),
    principle: validPrinciples(assessment).length > 0,
  };
}

/** One rating above 0, all four factors written, and at least one principle. */
export function isComplete(assessment: CentreAssessment): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(assessment));
}

export function liveCentreAssessments(list: readonly CentreAssessment[]): CentreAssessment[] {
  return list.filter(isLive);
}

export function isStarted(list: readonly CentreAssessment[]): boolean {
  return list.some(isLive);
}

/** "Mark done" is enabled once one live assessment is complete. */
export function canMarkDone(list: readonly CentreAssessment[]): boolean {
  return liveCentreAssessments(list).some(isComplete);
}

export function doneChecklist(
  list: readonly CentreAssessment[],
  labels: ChecklistLabels<CentresChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(
    CHECKLIST_KEYS,
    closestMet(liveCentreAssessments(list), CHECKLIST_KEYS, checklistMet),
    labels,
  );
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<CentresChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<CentresChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

export interface CentreDelta {
  readonly centre: CentreKey;
  readonly from: CentreRating;
  readonly to: CentreRating;
}

/** The centres whose rating changed since `previous`, in card order. */
export function deltas(
  latest: CentreAssessment,
  previous: CentreAssessment,
): readonly CentreDelta[] {
  return CENTRE_KEYS.map((centre) => ({
    centre,
    from: ratingOf(previous, centre),
    to: ratingOf(latest, centre),
  })).filter((delta) => delta.from !== delta.to);
}

/** The latest live assessment's principles as mission inputs (issue #61's contract): `text` is the
 * suggestion's key (#61 translates it through `exerciseKit.principle.*`) or the words as typed. */
export function latestPrinciples(list: readonly CentreAssessment[]): readonly MissionInputItem[] {
  const latest = latestAssessment(list);
  if (latest === null) {
    return [];
  }
  return validPrinciples(latest).map((principle) => {
    const text = principle.key ?? (principle.name ?? '').trim();
    return { id: principle.key ?? `name:${text.toLowerCase()}`, text };
  });
}

/** The hub's status: "Centre: Work" from the latest assessment's top centre, `null` without one.
 * One key per centre, since the hub's params are numbers only and the label is the centre's. */
export function hubStatus(list: readonly CentreAssessment[]): ExerciseHubStatus | null {
  const latest = latestAssessment(list);
  const centre = latest === null ? null : topCentre(latest);
  return centre === null
    ? null
    : { key: `habits.exercises.h2-centres.topCentre.${centre}`, count: 1 };
}

/** One history row: "Centre: Work" (already translated by the page, `''` with no top centre),
 * the date and the principle count. */
export function historyItems(
  history: readonly CentreAssessment[],
  topCentreLabels: Readonly<Record<CentreKey, string>>,
): AssessmentHistoryItem[] {
  return history.map((assessment) => {
    const centre = topCentre(assessment);
    return {
      id: assessment.id,
      date: assessment.date,
      label: centre === null ? '' : topCentreLabels[centre],
      summary: {
        key: 'h2Centres.list.principleCountText',
        count: validPrinciples(assessment).length,
      },
    };
  });
}

/** `translateSignal`'s array output keyed like `keys`, `''` per key before the scope loads
 * (playbook §6: an array key starts at `['']`). */
export function labelsByKey<K extends string>(
  keys: readonly K[],
  translated: readonly (string | undefined)[],
): Readonly<Record<K, string>> {
  return Object.fromEntries(keys.map((key, index) => [key, translated[index] ?? ''])) as Record<
    K,
    string
  >;
}

/** Merges `fields` into the live assessment `id` and bumps its `updatedAt`. */
export function editAssessment(
  list: readonly CentreAssessment[],
  id: string,
  fields: Partial<CentreAssessmentFields>,
  now: Date,
): CentreAssessment[] {
  return list.map((assessment) =>
    assessment.id === id && isLive(assessment)
      ? touch({ ...assessment, ...fields }, now)
      : assessment,
  );
}

/** Tombstones the assessment `id` (issue #203's delete pattern). */
export function removeAssessment(
  list: readonly CentreAssessment[],
  id: string,
  now: Date,
): CentreAssessment[] {
  return list.map((assessment) =>
    assessment.id === id ? softDelete(assessment, now) : assessment,
  );
}

/** Undoes `removeAssessment()`. */
export function restoreAssessment(
  list: readonly CentreAssessment[],
  id: string,
  now: Date,
): CentreAssessment[] {
  return list.map((assessment) =>
    assessment.id === id && !isLive(assessment)
      ? touch({ ...assessment, deletedAt: undefined }, now)
      : assessment,
  );
}
