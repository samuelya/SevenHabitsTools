import {
  blankChangeAttempts,
  ensureExercise,
  isComplete,
  isStepOneComplete,
  isStepThreeComplete,
  isStepTwoComplete,
  summarize,
  withChain,
  withChainAlt,
  withChangeAttempt,
  withDifference,
  withFirstView,
  withReflection,
  withSwitchDifficulty,
} from './perception.logic';
import { PerceptionExercise } from './perception.model';

const NOW = new Date('2026-01-10T00:00:00.000Z');

function completeExercise(): PerceptionExercise {
  let exercise = ensureExercise(null, NOW);
  exercise = withFirstView(exercise, 'They must be upset with me', NOW);
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
  exercise = withChain(exercise, { see: 'A', do: 'B', get: 'C' }, NOW);
  exercise = withChainAlt(exercise, { see: 'D', do: 'E', get: 'F' }, NOW);
  return exercise;
}

describe('perception.logic', () => {
  describe('ensureExercise', () => {
    it('creates a blank record with 3 blank change attempts when there is none yet', () => {
      const exercise = ensureExercise(null, NOW);
      expect(exercise.changeAttempts).toEqual(blankChangeAttempts());
      expect(exercise.switchDifficulty).toBe(0);
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

    it('withChain and withChainAlt merge into their own chain only', () => {
      const exercise = ensureExercise(null, NOW);
      const updated = withChain(exercise, { see: 'A' }, NOW);
      expect(updated.chain).toEqual({ see: 'A', do: '', get: '' });
      expect(updated.chainAlt).toEqual({ see: '', do: '', get: '' });
    });

    it('withReflection sets the reflection field', () => {
      const exercise = ensureExercise(null, NOW);
      const updated = withReflection(exercise, 'A note', NOW);
      expect(updated.reflection).toBe('A note');
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
      exercise = withChain(exercise, { see: 'A', do: 'B', get: 'C' }, NOW);
      expect(isStepThreeComplete(exercise)).toBe(false);
      exercise = withChainAlt(exercise, { see: 'D', do: 'E', get: 'F' }, NOW);
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

  describe('summarize', () => {
    it('counts 0 of 3 steps for a null exercise', () => {
      expect(summarize(null)).toEqual({ completedSteps: 0, totalSteps: 3 });
    });

    it('counts each completed step independently', () => {
      let exercise = ensureExercise(null, NOW);
      exercise = withFirstView(exercise, 'x', NOW);
      exercise = withSwitchDifficulty(exercise, 2, NOW);
      expect(summarize(exercise)).toEqual({ completedSteps: 1, totalSteps: 3 });
    });

    it('counts all 3 steps for a fully completed exercise', () => {
      expect(summarize(completeExercise())).toEqual({ completedSteps: 3, totalSteps: 3 });
    });
  });
});
