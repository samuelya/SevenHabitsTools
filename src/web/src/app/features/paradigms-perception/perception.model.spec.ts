import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  PERCEPTION_MODEL_KEY,
  PERCEPTION_PATH,
  PerceptionExercise,
  registerPerceptionModel,
} from './perception.model';

// Vitest here runs with `isolate: false` (shared module state) — see `backup.model.spec.ts` for
// why this re-asserts the registration instead of resetting it.
beforeEach(() => registerPerceptionModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === PERCEPTION_MODEL_KEY);
  if (!found) {
    throw new Error('paradigms-perception model was not registered');
  }
  return found;
}

const FULL_EXERCISE: PerceptionExercise = {
  id: 'p1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  firstView: 'They must be upset with me',
  viewBRevealed: true,
  switchDifficulty: 4,
  changeAttempts: [
    { text: 'Tried a new morning routine', kind: 'technique' },
    { text: 'Practiced listening before reacting', kind: 'character' },
    { text: 'Set a strict schedule', kind: 'technique' },
  ],
  difference: 'A technique fades once the effort stops; character sticks because it changed me.',
  chain: { see: 'A rude coworker', do: 'I avoid them', get: 'A tense team' },
  chainAlt: { see: 'A distracted coworker', do: 'I check in with them', get: 'A trusted team' },
  reflection: 'I want to check my assumptions before reacting next time.',
};

describe('paradigms-perception model', () => {
  it('registers at habits.paradigms.perception', () => {
    expect(registration().path).toBe(PERCEPTION_PATH);
  });

  it('defaults to null (a worksheet, created on the first edit)', () => {
    expect(registration().defaults()).toBeNull();
  });

  it('registers the exercise for the paradigms habit at its route', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === PERCEPTION_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: PERCEPTION_MODEL_KEY,
      habit: 'paradigms',
      titleKey: 'habits.exercises.paradigms-perception.title',
      summaryKey: 'habits.exercises.paradigms-perception.summary',
      icon: 'visibility',
      route: 'habits/paradigms/perception',
      // Issue #216: built from this exercise's own pure `isStarted()` predicate.
      isStarted: expect.any(Function),
    });
  });

  it('validates null', () => {
    expect(registration().validate?.(null)).toBe(true);
  });

  it('validates a fully filled exercise', () => {
    expect(registration().validate?.(FULL_EXERCISE)).toBe(true);
  });

  it('validates an exercise whose switchDifficulty is not yet rated (null)', () => {
    expect(registration().validate?.({ ...FULL_EXERCISE, switchDifficulty: null })).toBe(true);
  });

  it('rejects a switchDifficulty outside the 1-5 range', () => {
    expect(registration().validate?.({ ...FULL_EXERCISE, switchDifficulty: 0 })).toBe(false);
    expect(registration().validate?.({ ...FULL_EXERCISE, switchDifficulty: 6 })).toBe(false);
  });

  it('rejects an exercise missing a required base or domain field', () => {
    const withoutFirstView: Record<string, unknown> = { ...FULL_EXERCISE };
    delete withoutFirstView['firstView'];
    expect(registration().validate?.(withoutFirstView)).toBe(false);
  });

  it('rejects an exercise with a non-boolean viewBRevealed', () => {
    expect(registration().validate?.({ ...FULL_EXERCISE, viewBRevealed: 'yes' })).toBe(false);
  });

  it('rejects an exercise with a change attempt of the wrong kind or count', () => {
    expect(
      registration().validate?.({
        ...FULL_EXERCISE,
        changeAttempts: [{ text: 'x', kind: 'unknown' }],
      }),
    ).toBe(false);
    expect(
      registration().validate?.({
        ...FULL_EXERCISE,
        changeAttempts: FULL_EXERCISE.changeAttempts.slice(0, 2),
      }),
    ).toBe(false);
  });

  it('rejects an exercise with a malformed chain', () => {
    expect(registration().validate?.({ ...FULL_EXERCISE, chain: { see: 'x', do: 'y' } })).toBe(
      false,
    );
  });

  it('rejects a non-object, non-null value', () => {
    expect(registration().validate?.('nope')).toBe(false);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { paradigms: { perception: FULL_EXERCISE } } });
    expect(issues.filter((issue) => issue.path === PERCEPTION_PATH)).toEqual([]);
  });
});
