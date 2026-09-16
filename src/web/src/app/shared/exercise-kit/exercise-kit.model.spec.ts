import { getRegisteredModels } from '../../core/data/registry';
import {
  EXERCISE_COMPLETIONS_MODEL_KEY,
  EXERCISE_COMPLETIONS_PATH,
  registerExerciseKitModel,
} from './exercise-kit.model';

describe('exercise-kit model', () => {
  // Vitest here runs with `isolate: false` (shared module state) — see `backup.model.spec.ts` for
  // why this re-asserts the registration instead of resetting it.
  beforeEach(() => registerExerciseKitModel());

  function registration() {
    const found = getRegisteredModels().find(
      (model) => model.key === EXERCISE_COMPLETIONS_MODEL_KEY,
    );
    if (!found) {
      throw new Error('exerciseCompletions model was not registered');
    }
    return found;
  }

  it('registers at shared.exerciseCompletions', () => {
    expect(registration().path).toBe(EXERCISE_COMPLETIONS_PATH);
  });

  it('defaults to an empty array', () => {
    expect(registration().defaults()).toEqual([]);
  });

  it('validates a well-formed completion array', () => {
    expect(
      registration().validate?.([
        {
          id: 'c1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          exerciseId: 'h2-mission',
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    ).toBe(true);
  });

  it('validates an empty array', () => {
    expect(registration().validate?.([])).toBe(true);
  });

  it('rejects a completion missing a required field', () => {
    expect(registration().validate?.([{ id: 'c1', createdAt: '2026-01-01T00:00:00.000Z' }])).toBe(
      false,
    );
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
    expect(registration().validate?.(null)).toBe(false);
  });
});
