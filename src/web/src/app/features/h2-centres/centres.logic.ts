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
  sortedByDateDesc,
  type AssessmentHistoryItem,
} from '../../shared/exercise-kit/assessment-history.logic';
import type { MissionInputItem } from '../../shared/mission-inputs/mission-inputs';
import type {
  CentreAssessment,
  CentreAssessmentFields,
  CentreFactors,
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

/** The one rating rule, for `validate()` and every reader: an integer 0–3. */
export function isRating(value: unknown): value is CentreRating {
  return (RATINGS as readonly unknown[]).includes(value);
}

/** `centre`'s stored rating, `null` when unrated (the editor shows no choice); anything else an
 * import may hold reads as unrated. */
export function ratedValue(assessment: CentreAssessment, centre: CentreKey): CentreRating | null {
  const rating: unknown = assessment.ratings[centre];
  return isRating(rating) ? rating : null;
}

/** `centre`'s rating, 0 when unrated. */
export function ratingOf(assessment: CentreAssessment, centre: CentreKey): CentreRating {
  return ratedValue(assessment, centre) ?? 0;
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

/** Every centre sharing the highest rating, in card order; empty when every rating is 0. */
export function topCentres(assessment: CentreAssessment): readonly CentreKey[] {
  const entries = ranked(assessment);
  const best = entries[0].rating;
  return best > 0 ? entries.filter((entry) => entry.rating === best).map((e) => e.centre) : [];
}

/** The top centre the four factors are about: the stored `factorsCentre` while it is still among
 * the top-rated (the user's pick in a tie), else the first of them; `null` when every rating is
 * 0. */
export function chosenCentre(assessment: CentreAssessment): CentreKey | null {
  const top = topCentres(assessment);
  const stored = assessment.factorsCentre;
  return stored !== undefined && top.includes(stored) ? stored : (top[0] ?? null);
}

/** Whether more than one centre shares the top rating. */
export function isTied(assessment: CentreAssessment): boolean {
  return topCentres(assessment).length > 1;
}

/** `assessment`'s ratings with `centre` set to `rating`. */
export function withRating(
  assessment: CentreAssessment,
  centre: CentreKey,
  rating: CentreRating,
): CentreAssessment['ratings'] {
  return { ...assessment.ratings, [centre]: rating };
}

/** The factor answers written about `centre`: none when they were written about another one. */
export function factorsFor(assessment: CentreAssessment, centre: CentreKey | null): CentreFactors {
  return centre !== null && assessment.factorsCentre === centre ? (assessment.factors ?? {}) : {};
}

/** Sets `factor` to `text` about the chosen centre. Answers written about another centre are
 * replaced, never carried over to this one. */
export function withFactor(
  assessment: CentreAssessment,
  factor: FactorKey,
  text: string,
): Pick<CentreAssessmentFields, 'factors' | 'factorsCentre'> {
  const centre = chosenCentre(assessment);
  if (centre === null) {
    return { factors: assessment.factors, factorsCentre: assessment.factorsCentre };
  }
  return { factors: { ...factorsFor(assessment, centre), [factor]: text }, factorsCentre: centre };
}

/** The user's pick in a tie: the factors are about `centre` from now on, so answers written
 * about another centre are cleared. `null` when nothing changes. */
export function withFactorsCentre(
  assessment: CentreAssessment,
  centre: CentreKey,
): Pick<CentreAssessmentFields, 'factors' | 'factorsCentre'> | null {
  if (assessment.factorsCentre === centre || !topCentres(assessment).includes(centre)) {
    return null;
  }
  return { factors: {}, factorsCentre: centre };
}

/** A principle's identity: its key, or its words trimmed and case-folded. */
function principleId(principle: CentrePrinciple): string {
  return principle.key ?? `name:${(principle.name ?? '').trim().toLowerCase()}`;
}

/** The principles every reader uses: exactly one of `key`/`name` set (a name with text), first
 * of each duplicate kept. Anything else an import may hold is dropped, so the limit and the chips
 * never count it. */
export function validPrinciples(assessment: CentreAssessment): readonly CentrePrinciple[] {
  const seen = new Set<string>();
  return assessment.principles.filter((principle) => {
    if ((principle.key !== undefined) === hasText(principle.name)) {
      return false;
    }
    const id = principleId(principle);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
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
    CENTRE_KEYS.some((centre) => ratedValue(assessment, centre) !== null) ||
    FACTOR_KEYS.some((factor) => hasText(assessment.factors?.[factor])) ||
    validPrinciples(assessment).length > 0
  );
}

/** The three gate items (issue #60), in the order the user meets them. */
export const CHECKLIST_KEYS = ['ratings', 'factors', 'principle'] as const;
export type CentresChecklistKey = (typeof CHECKLIST_KEYS)[number];

function checklistMet(assessment: CentreAssessment): ChecklistMet<CentresChecklistKey> {
  const top = topCentres(assessment);
  const about = assessment.factorsCentre;
  return {
    ratings: top.length > 0,
    // Met only while the centre the answers were written about is still among the top-rated.
    factors:
      about !== undefined &&
      top.includes(about) &&
      FACTOR_KEYS.every((factor) => hasText(assessment.factors?.[factor])),
    principle: validPrinciples(assessment).length > 0,
  };
}

/** One rating above 0, all four factors written about a top centre, and at least one principle. */
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

/** The newest live complete assessment, else the newest live one that `has` what the reader
 * needs: a just-started assessment doesn't replace a complete one until it is complete itself. */
function newestFor(
  list: readonly CentreAssessment[],
  has: (assessment: CentreAssessment) => boolean,
): CentreAssessment | null {
  const newestFirst = sortedByDateDesc(liveCentreAssessments(list));
  return newestFirst.find(isComplete) ?? newestFirst.find(has) ?? null;
}

/** The principles Your mission offers (issue #61's contract), from `newestFor()`: `text` is the
 * label in the current language (a suggestion) or the words as typed, and `key` tells a
 * suggestion apart. A suggestion is left out until its label has loaded. */
export function principleInputs(
  list: readonly CentreAssessment[],
  keyLabels: Readonly<Record<PrincipleKey, string>>,
): readonly MissionInputItem[] {
  const source = newestFor(list, (assessment) => validPrinciples(assessment).length > 0);
  if (source === null) {
    return [];
  }
  return validPrinciples(source)
    .map((principle) => ({
      id: principleId(principle),
      text: principleLabel(principle, keyLabels).trim(),
      ...(principle.key !== undefined ? { key: principle.key } : {}),
    }))
    .filter((item) => item.text !== '');
}

/** The hub's status, "Centre: Work" ("Centre: Work (tied)" in a tie), from `newestFor()`'s chosen
 * centre, `null` without one. The hub translates the centre's title from this scope. */
export function hubStatus(list: readonly CentreAssessment[]): ExerciseHubStatus | null {
  const source = newestFor(list, (assessment) => chosenCentre(assessment) !== null);
  const centre = source === null ? null : chosenCentre(source);
  if (source === null || centre === null) {
    return null;
  }
  return {
    key: isTied(source)
      ? 'habits.exercises.h2-centres.statusTied'
      : 'habits.exercises.h2-centres.status',
    count: 1,
    keyParams: { centre: { scope: 'h2-centres', key: `centre.${centre}.title` } },
  };
}

/** One history row: "Centre: Work" (already translated by the page, `''` with no top centre),
 * the date and the principle count. */
export function historyItems(
  history: readonly CentreAssessment[],
  topCentreLabels: Readonly<Record<CentreKey, string>>,
): AssessmentHistoryItem[] {
  return history.map((assessment) => {
    const centre = chosenCentre(assessment);
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
