import { newRecord, touch } from '../../core/data/record';
import { ChangeAttempt, PerceptionChain, PerceptionExercise } from './perception.model';

/** The valid range of `switchDifficulty` once the user has actually rated it — `0` is "not yet
 * rated" (see `PerceptionExercise`'s own doc comment). */
export const SWITCH_DIFFICULTY_MIN = 1;
export const SWITCH_DIFFICULTY_MAX = 5;
const SWITCH_DIFFICULTY_UNSET = 0;

function blankChain(): PerceptionChain {
  return { see: '', do: '', get: '' };
}

/** Exactly 3 blank attempts — this exercise's fixed count (issue #48), reused both for a brand
 * new record and for the page's display value before one exists at all. */
export function blankChangeAttempts(): readonly ChangeAttempt[] {
  return [
    { text: '', kind: 'technique' },
    { text: '', kind: 'technique' },
    { text: '', kind: 'technique' },
  ];
}

function blankExercise(now: Date): PerceptionExercise {
  return newRecord(
    {
      firstView: '',
      switchDifficulty: SWITCH_DIFFICULTY_UNSET,
      changeAttempts: blankChangeAttempts(),
      difference: '',
      chain: blankChain(),
      chainAlt: blankChain(),
      reflection: '',
    },
    now,
  );
}

/** Creates the record on its first edit (worksheet type, playbook §4: `defaults: () => null`),
 * otherwise returns `current` unchanged so a later edit never resets its id or `createdAt`. */
export function ensureExercise(current: PerceptionExercise | null, now: Date): PerceptionExercise {
  return current ?? blankExercise(now);
}

export function withFirstView(
  exercise: PerceptionExercise,
  firstView: string,
  now: Date,
): PerceptionExercise {
  return touch({ ...exercise, firstView }, now);
}

export function withSwitchDifficulty(
  exercise: PerceptionExercise,
  switchDifficulty: number,
  now: Date,
): PerceptionExercise {
  return touch({ ...exercise, switchDifficulty }, now);
}

export function withChangeAttempt(
  exercise: PerceptionExercise,
  index: number,
  fields: Partial<ChangeAttempt>,
  now: Date,
): PerceptionExercise {
  const changeAttempts = exercise.changeAttempts.map((attempt, i) =>
    i === index ? { ...attempt, ...fields } : attempt,
  );
  return touch({ ...exercise, changeAttempts }, now);
}

export function withDifference(
  exercise: PerceptionExercise,
  difference: string,
  now: Date,
): PerceptionExercise {
  return touch({ ...exercise, difference }, now);
}

export function withChain(
  exercise: PerceptionExercise,
  fields: Partial<PerceptionChain>,
  now: Date,
): PerceptionExercise {
  return touch({ ...exercise, chain: { ...exercise.chain, ...fields } }, now);
}

export function withChainAlt(
  exercise: PerceptionExercise,
  fields: Partial<PerceptionChain>,
  now: Date,
): PerceptionExercise {
  return touch({ ...exercise, chainAlt: { ...exercise.chainAlt, ...fields } }, now);
}

export function withReflection(
  exercise: PerceptionExercise,
  reflection: string,
  now: Date,
): PerceptionExercise {
  return touch({ ...exercise, reflection }, now);
}

export function isStepOneComplete(exercise: PerceptionExercise): boolean {
  return (
    Boolean(exercise.firstView.trim()) &&
    exercise.switchDifficulty >= SWITCH_DIFFICULTY_MIN &&
    exercise.switchDifficulty <= SWITCH_DIFFICULTY_MAX
  );
}

export function isStepTwoComplete(exercise: PerceptionExercise): boolean {
  return (
    exercise.changeAttempts.length === 3 &&
    exercise.changeAttempts.every((attempt) => Boolean(attempt.text.trim())) &&
    Boolean(exercise.difference.trim())
  );
}

function isChainComplete(chain: PerceptionChain): boolean {
  return Boolean(chain.see.trim()) && Boolean(chain.do.trim()) && Boolean(chain.get.trim());
}

export function isStepThreeComplete(exercise: PerceptionExercise): boolean {
  return isChainComplete(exercise.chain) && isChainComplete(exercise.chainAlt);
}

/** `isComplete()` (issue #48's "Implementation notes"): every required field across the three
 * steps; `reflection` stays optional. */
export function isComplete(exercise: PerceptionExercise | null): boolean {
  return (
    exercise !== null &&
    isStepOneComplete(exercise) &&
    isStepTwoComplete(exercise) &&
    isStepThreeComplete(exercise)
  );
}

/** The footer summary card's progress (issue #48's acceptance criteria: a done state from the
 * kit) — how many of the 3 fixed steps are complete. */
export interface PerceptionProgress {
  readonly completedSteps: number;
  readonly totalSteps: number;
}

const TOTAL_STEPS = 3;

export function summarize(exercise: PerceptionExercise | null): PerceptionProgress {
  if (exercise === null) {
    return { completedSteps: 0, totalSteps: TOTAL_STEPS };
  }
  const completedSteps = [
    isStepOneComplete(exercise),
    isStepTwoComplete(exercise),
    isStepThreeComplete(exercise),
  ].filter(Boolean).length;
  return { completedSteps, totalSteps: TOTAL_STEPS };
}
