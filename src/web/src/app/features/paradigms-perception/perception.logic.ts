import { newRecord, touch } from '../../core/data/record';
import {
  ChangeAttempt,
  PerceptionChain,
  PerceptionExercise,
  SWITCH_DIFFICULTY_MAX,
  SWITCH_DIFFICULTY_MIN,
} from './perception.model';

/** The two chains this exercise tracks (step 3): the user's current paradigm and the
 * alternative one, kept as sibling fields rather than an array since there are always exactly
 * these two, each with its own fixed legend. */
export type ChainKey = 'chain' | 'chainAlt';

export function blankChain(): PerceptionChain {
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
      viewBRevealed: false,
      switchDifficulty: null,
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

/** Step 1's "show the alternative view" moment (review finding on this PR): persisted on the
 * record itself, not page-local UI state, so it survives `PerceptionPage` being destroyed and
 * recreated on navigating away and back (no custom `RouteReuseStrategy` for this route) as well
 * as a reload. Only ever moves `false` → `true`; there is no "hide it again". */
export function withViewBRevealed(exercise: PerceptionExercise, now: Date): PerceptionExercise {
  return touch({ ...exercise, viewBRevealed: true }, now);
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

/** Parameterized over which of the two chains changed (review finding on this PR: `withChain`/
 * `withChainAlt` were copy-paste duplicates), the same shape `withChangeAttempt`'s `index` already
 * uses for its own fixed-count list. */
export function withChainField(
  exercise: PerceptionExercise,
  chainKey: ChainKey,
  fields: Partial<PerceptionChain>,
  now: Date,
): PerceptionExercise {
  return touch({ ...exercise, [chainKey]: { ...exercise[chainKey], ...fields } }, now);
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
    exercise.switchDifficulty !== null &&
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
