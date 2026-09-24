import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  registerTransitionModel,
  Script,
  TRANSITION_MODEL_KEY,
  TRANSITION_PATH,
} from './transition.model';

// Vitest here runs with `isolate: false` (shared module state) — see `backup.model.spec.ts` for
// why this re-asserts the registration instead of resetting it.
beforeEach(() => registerTransitionModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === TRANSITION_MODEL_KEY);
  if (!found) {
    throw new Error('paradigms-transition model was not registered');
  }
  return found;
}

const FULL_SCRIPT: Script = {
  id: 's1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  text: 'Conflict means someone has to lose',
  source: 'family',
  effect: 'harms',
  decision: 'stop',
  newScript: 'Conflict is a chance to find a better answer together',
  situation: "This week's budget conversation",
};

describe('paradigms-transition model', () => {
  it('registers at habits.paradigms.scripts', () => {
    expect(registration().path).toBe(TRANSITION_PATH);
  });

  it('defaults to an empty array', () => {
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise for the paradigms habit at its route', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === TRANSITION_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: TRANSITION_MODEL_KEY,
      habit: 'paradigms',
      titleKey: 'habits.exercises.paradigms-transition.title',
      shortTitleKey: 'habits.exercises.paradigms-transition.shortTitle',
      icon: 'compare_arrows',
      route: 'habits/paradigms/transition',
      // Issue #216: built from this exercise's own pure `isStarted()` predicate.
      // Issue #219: chapter order on the hub, and the status column's in-progress text.
      order: 20,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('validates an empty array', () => {
    expect(registration().validate?.([])).toBe(true);
  });

  it('validates a fully filled script, including one with no decision fields set', () => {
    expect(registration().validate?.([FULL_SCRIPT])).toBe(true);
    const kept: Script = {
      ...FULL_SCRIPT,
      decision: 'keep',
      newScript: undefined,
      situation: undefined,
    };
    expect(registration().validate?.([kept])).toBe(true);
  });

  it('rejects a script missing a required base or domain field', () => {
    const withoutText: Record<string, unknown> = { ...FULL_SCRIPT };
    delete withoutText['text'];
    expect(registration().validate?.([withoutText])).toBe(false);
  });

  it('rejects a script with an unknown source, effect or decision', () => {
    expect(registration().validate?.([{ ...FULL_SCRIPT, source: 'nowhere' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_SCRIPT, effect: 'unknown' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_SCRIPT, decision: 'ignore' }])).toBe(false);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { paradigms: { scripts: [FULL_SCRIPT] } } });
    expect(issues.filter((issue) => issue.path === TRANSITION_PATH)).toEqual([]);
  });
});
