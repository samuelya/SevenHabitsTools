import {
  blankChangeAttempts,
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  ensureExercise,
  isComplete,
  isStarted,
  isStepOneComplete,
  isStepThreeComplete,
  isStepTwoComplete,
  withChainField,
  withChangeAttempt,
  withDifference,
  withFirstView,
  withReflection,
  withSwitchDifficulty,
  withViewBRevealed,
} from './perception.logic';
import { PerceptionExercise } from './perception.model';

const NOW = new Date('2026-01-10T00:00:00.000Z');

const LABELS = checklistLabelsFrom([
  'Write why you think they did not wave back',
  'Rate how hard it was to drop your first guess',
  'Fill in all three attempts',
  'Write the one-sentence difference',
  'Trace the situation both ways',
]);

function completeExercise(): PerceptionExercise {
  let exercise = ensureExercise(null, NOW);
  exercise = withFirstView(exercise, 'They must be upset with me', NOW);
  exercise = withViewBRevealed(exercise, NOW);
  exercise = withSwitchDifficulty(exercise, 4, NOW);
  exercise = withChangeAttempt(exercise, 0, { text: 'Tried a new routine' }, NOW);
  exercise = withChangeAttempt(
    exercise,
    1,
    { text: 'Practiced listening', kind: 'character' },
    NOW,
  );
  exercise = withChangeAttempt(exercise, 2, { text: 'Set a strict schedule' }, NOW);
  exercise = withDifference(exercise, 'One fades, the other sticks.', NOW);
  exercise = withChainField(exercise, 'chain', { see: 'A', do: 'B', get: 'C' }, NOW);
  exercise = withChainField(exercise, 'chainAlt', { see: 'D', do: 'E', get: 'F' }, NOW);
  return exercise;
}

describe('perception.logic', () => {
  describe('ensureExercise', () => {
    it('creates a blank record with 3 blank change attempts when there is none yet', () => {
      const exercise = ensureExercise(null, NOW);
      expect(exercise.changeAttempts).toEqual(blankChangeAttempts());
      expect(exercise.switchDifficulty).toBeNull();
      expect(exercise.viewBRevealed).toBe(false);
      expect(exercise.createdAt).toBe(NOW.toISOString());
    });

    it('returns the existing record unchanged, never re-creating its id', () => {
      const existing = ensureExercise(null, NOW);
      expect(ensureExercise(existing, new Date('2026-02-01T00:00:00.000Z'))).toBe(existing);
    });
  });

  describe('field updaters', () => {
    it('withFirstView sets the field and bumps updatedAt', () => {
      const exercise = ensureExercise(null, NOW);
      const later = new Date('2026-01-11T00:00:00.000Z');
      const updated = withFirstView(exercise, 'A new interpretation', later);
      expect(updated.firstView).toBe('A new interpretation');
      expect(updated.updatedAt).toBe(later.toISOString());
    });

    it('withChangeAttempt edits only the targeted attempt', () => {
      const exercise = ensureExercise(null, NOW);
      const updated = withChangeAttempt(exercise, 1, { text: 'x', kind: 'character' }, NOW);
      expect(updated.changeAttempts[0]).toEqual(blankChangeAttempts()[0]);
      expect(updated.changeAttempts[1]).toEqual({ text: 'x', kind: 'character' });
      expect(updated.changeAttempts[2]).toEqual(blankChangeAttempts()[2]);
    });

    it('withChainField merges into only the targeted chain', () => {
      const exercise = ensureExercise(null, NOW);
      const updated = withChainField(exercise, 'chain', { see: 'A' }, NOW);
      expect(updated.chain).toEqual({ see: 'A', do: '', get: '' });
      expect(updated.chainAlt).toEqual({ see: '', do: '', get: '' });
    });

    it('withReflection sets the reflection field', () => {
      const exercise = ensureExercise(null, NOW);
      const updated = withReflection(exercise, 'A note', NOW);
      expect(updated.reflection).toBe('A note');
    });

    it('withViewBRevealed only ever moves false to true', () => {
      const exercise = ensureExercise(null, NOW);
      expect(exercise.viewBRevealed).toBe(false);
      const updated = withViewBRevealed(exercise, NOW);
      expect(updated.viewBRevealed).toBe(true);
    });
  });

  describe('step completeness', () => {
    it('isStepOneComplete requires firstView and an in-range switchDifficulty', () => {
      let exercise = ensureExercise(null, NOW);
      expect(isStepOneComplete(exercise)).toBe(false);
      exercise = withFirstView(exercise, 'x', NOW);
      expect(isStepOneComplete(exercise)).toBe(false);
      exercise = withSwitchDifficulty(exercise, 3, NOW);
      expect(isStepOneComplete(exercise)).toBe(true);
      expect(isStepOneComplete(withSwitchDifficulty(exercise, 0, NOW))).toBe(false);
    });

    it('isStepTwoComplete requires all 3 attempts filled and a difference sentence', () => {
      let exercise = ensureExercise(null, NOW);
      exercise = withChangeAttempt(exercise, 0, { text: 'a' }, NOW);
      exercise = withChangeAttempt(exercise, 1, { text: 'b' }, NOW);
      expect(isStepTwoComplete(exercise)).toBe(false);
      exercise = withChangeAttempt(exercise, 2, { text: 'c' }, NOW);
      expect(isStepTwoComplete(exercise)).toBe(false);
      exercise = withDifference(exercise, 'because', NOW);
      expect(isStepTwoComplete(exercise)).toBe(true);
    });

    it('isStepThreeComplete requires every field of both chains', () => {
      let exercise = ensureExercise(null, NOW);
      exercise = withChainField(exercise, 'chain', { see: 'A', do: 'B', get: 'C' }, NOW);
      expect(isStepThreeComplete(exercise)).toBe(false);
      exercise = withChainField(exercise, 'chainAlt', { see: 'D', do: 'E', get: 'F' }, NOW);
      expect(isStepThreeComplete(exercise)).toBe(true);
    });
  });

  describe('isComplete', () => {
    it('is false for null and for a partially filled exercise', () => {
      expect(isComplete(null)).toBe(false);
      expect(isComplete(ensureExercise(null, NOW))).toBe(false);
    });

    it('is true once all three steps are complete, with reflection left blank', () => {
      expect(isComplete(completeExercise())).toBe(true);
    });
  });

  describe('doneChecklist', () => {
    it('lists all five items, unmet, for a null exercise', () => {
      const items = doneChecklist(null, LABELS);
      expect(items).toHaveLength(5);
      expect(items.every((item) => !item.met)).toBe(true);
      expect(items.map((item) => item.label)).toEqual(CHECKLIST_KEYS.map((key) => LABELS[key]));
    });

    it('flips each item independently as its own field is filled', () => {
      let exercise = ensureExercise(null, NOW);
      const metFor = (key: (typeof CHECKLIST_KEYS)[number]) =>
        doneChecklist(exercise, LABELS).find((item) => item.label === LABELS[key])?.met;

      expect(CHECKLIST_KEYS.every((key) => metFor(key) === false)).toBe(true);

      exercise = withFirstView(exercise, 'x', NOW);
      expect(metFor('firstView')).toBe(true);
      expect(metFor('difficulty')).toBe(false);

      exercise = withSwitchDifficulty(exercise, 3, NOW);
      expect(metFor('difficulty')).toBe(true);
      expect(metFor('attempts')).toBe(false);

      exercise = withChangeAttempt(exercise, 0, { text: 'a' }, NOW);
      exercise = withChangeAttempt(exercise, 1, { text: 'b' }, NOW);
      exercise = withChangeAttempt(exercise, 2, { text: 'c' }, NOW);
      expect(metFor('attempts')).toBe(true);
      expect(metFor('difference')).toBe(false);

      exercise = withDifference(exercise, 'because', NOW);
      expect(metFor('difference')).toBe(true);
      expect(metFor('chains')).toBe(false);

      exercise = withChainField(exercise, 'chain', { see: 'A', do: 'B', get: 'C' }, NOW);
      exercise = withChainField(exercise, 'chainAlt', { see: 'D', do: 'E', get: 'F' }, NOW);
      expect(metFor('chains')).toBe(true);
    });

    it('agrees with isComplete: every item met exactly when isComplete is true', () => {
      const exercise = completeExercise();
      expect(doneChecklist(exercise, LABELS).every((item) => item.met)).toBe(true);
      expect(isComplete(exercise)).toBe(true);
    });
  });

  describe('checklistLabelsFrom', () => {
    it('falls back to an empty string per key when the scope has not loaded yet', () => {
      expect(checklistLabelsFrom([''])).toEqual({
        firstView: '',
        difficulty: '',
        attempts: '',
        difference: '',
        chains: '',
      });
    });
  });

  describe('checklistLoaded', () => {
    // Regression test for a review finding: `DoneToggle` used to render its checklist off
    // `checklistLabelsFrom`'s output directly, so a cold visit showed five icon rows with no text
    // for as long as the scope took to load (`translateSignal` starts an array key at `['']`).
    it('is false while every label is still the pre-load placeholder', () => {
      expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    });

    it('is true once the scope has resolved real labels', () => {
      expect(checklistLoaded(LABELS)).toBe(true);
    });
  });

  describe('isStarted', () => {
    it('is false for a null exercise and true once a record exists', () => {
      expect(isStarted(null)).toBe(false);
      expect(isStarted(ensureExercise(null, NOW))).toBe(true);
    });
  });
});
