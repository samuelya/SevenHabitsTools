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

function isChainComplete(chain: PerceptionChain): boolean {
  return Boolean(chain.see.trim()) && Boolean(chain.do.trim()) && Boolean(chain.get.trim());
}

/** The five gate items (issue #212's "Gate as a checklist"), in the fixed order the page's
 * `GuidedStepper` steps follow. */
export const CHECKLIST_KEYS = [
  'firstView',
  'difficulty',
  'attempts',
  'difference',
  'chains',
] as const;
export type PerceptionChecklistKey = (typeof CHECKLIST_KEYS)[number];

type ChecklistMet = Readonly<Record<PerceptionChecklistKey, boolean>>;

/** The "met" half of each checklist item, computed once and shared by `isStepOneComplete`/
 * `isStepTwoComplete`/`isStepThreeComplete`, `doneChecklist()` and `isComplete()` — a single
 * source of truth so the stepper's per-step check, the gate list and the "Mark done" button can
 * never disagree. */
function checklistMet(exercise: PerceptionExercise | null): ChecklistMet {
  if (exercise === null) {
    return {
      firstView: false,
      difficulty: false,
      attempts: false,
      difference: false,
      chains: false,
    };
  }
  return {
    firstView: Boolean(exercise.firstView.trim()),
    difficulty:
      exercise.switchDifficulty !== null &&
      exercise.switchDifficulty >= SWITCH_DIFFICULTY_MIN &&
      exercise.switchDifficulty <= SWITCH_DIFFICULTY_MAX,
    attempts:
      exercise.changeAttempts.length === 3 &&
      exercise.changeAttempts.every((attempt) => Boolean(attempt.text.trim())),
    difference: Boolean(exercise.difference.trim()),
    chains: isChainComplete(exercise.chain) && isChainComplete(exercise.chainAlt),
  };
}

export function isStepOneComplete(exercise: PerceptionExercise): boolean {
  const met = checklistMet(exercise);
  return met.firstView && met.difficulty;
}

export function isStepTwoComplete(exercise: PerceptionExercise): boolean {
  const met = checklistMet(exercise);
  return met.attempts && met.difference;
}

export function isStepThreeComplete(exercise: PerceptionExercise): boolean {
  return checklistMet(exercise).chains;
}

/** `isComplete()` (issue #48's "Implementation notes", refined by #212's checklist): every
 * required field across the three steps; `reflection` stays optional. Reduces the exact same
 * `checklistMet()` `doneChecklist()` does, so the gate button and the checklist it shows can never
 * disagree. */
export function isComplete(exercise: PerceptionExercise | null): boolean {
  const met = checklistMet(exercise);
  return CHECKLIST_KEYS.every((key) => met[key]);
}

/** One line of `DoneToggle`'s checklist (`shared/exercise-kit/done-toggle/done-toggle.ts`). */
export interface ChecklistItem {
  readonly label: string;
  readonly met: boolean;
}

/** The five gate items, `label`ed and ordered for `DoneToggle` (issue #212). `labels` is
 * already-translated text keyed by `PerceptionChecklistKey` — pass `CHECKLIST_KEYS.map((key) =>
 * \`checklist.${key}\`)` through `translateSignal` and `checklistLabelsFrom()` its result (the
 * playbook §6 "Reactive labels" pattern), so this function stays testable without a translation
 * service. */
export function doneChecklist(
  exercise: PerceptionExercise | null,
  labels: Readonly<Record<PerceptionChecklistKey, string>>,
): readonly ChecklistItem[] {
  const met = checklistMet(exercise);
  return CHECKLIST_KEYS.map((key) => ({ label: labels[key], met: met[key] }));
}

/** `translateSignal`'s array output, back into a record keyed the same way `doneChecklist()`
 * reads it — falls back to `''` per key before the scope has loaded (playbook §6's second
 * pitfall: `translateSignal` starts an array key at `['']`, not one empty string per key). */
export function checklistLabelsFrom(
  labels: readonly string[],
): Readonly<Record<PerceptionChecklistKey, string>> {
  return Object.fromEntries(
    CHECKLIST_KEYS.map((key, index) => [key, labels[index] ?? '']),
  ) as Readonly<Record<PerceptionChecklistKey, string>>;
}

/** Whether `checklistLabelsFrom()`'s output is real translated text yet, not the placeholder
 * `translateSignal` returns before the scope loads (review finding on this PR): `DoneToggle`
 * would otherwise render all five checklist rows with blank labels on a cold visit, the same
 * "gate on loaded content" `PerceptionPage.guideContent` already does with `howTo.length`. */
export function checklistLoaded(labels: Readonly<Record<PerceptionChecklistKey, string>>): boolean {
  return labels[CHECKLIST_KEYS[0]] !== '';
}

/** "Started" (issue #212's Implementation notes): a worksheet record exists only after the first
 * edit, so this needs no stored flag and no migration — a user who read the intro but typed
 * nothing sees it expanded again, which is the intended outcome. */
export function isStarted(exercise: PerceptionExercise | null): boolean {
  return exercise !== null;
}
