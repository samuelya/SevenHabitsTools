import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  AFFIRMATIONS_MODEL_KEY,
  AFFIRMATIONS_PATH,
  AFFIRMATIONS_ROUTE,
  Affirmation,
  registerAffirmationsModel,
} from './affirmations.model';

// Vitest here runs with `isolate: false` (shared module state): re-assert, don't reset.
beforeEach(() => registerAffirmationsModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === AFFIRMATIONS_MODEL_KEY);
  if (!found) {
    throw new Error('h2-affirmations model was not registered');
  }
  return found;
}

const FULL_ITEM: Affirmation = {
  id: 'a1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  text: 'When my son slams the door, I breathe out and ask what happened.',
  checks: { personal: true, positive: true, present: true, visual: true, emotional: false },
  scene: 'The hallway after school.',
  archived: true,
  practiceSeconds: 60,
  practice: [{ date: '2026-09-02', seconds: 42 }],
  sample: false,
};

describe('h2-affirmations model', () => {
  it('registers at habits.h2.affirmations with an empty default', () => {
    expect(registration().path).toBe(AFFIRMATIONS_PATH);
    expect(AFFIRMATIONS_PATH).toBe('habits.h2.affirmations');
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise at order 60 on the Habit 2 hub with its short title', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === AFFIRMATIONS_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: 'h2-affirmations',
      habit: 'h2',
      titleKey: 'habits.exercises.h2-affirmations.title',
      shortTitleKey: 'habits.exercises.h2-affirmations.shortTitle',
      icon: 'self_improvement',
      route: AFFIRMATIONS_ROUTE,
      order: 60,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
    expect(AFFIRMATIONS_ROUTE).toBe('habits/h2/affirmations');
  });

  it('validates an empty array, a fully filled affirmation and a minimal one', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL_ITEM])).toBe(true);
    const minimal: Record<string, unknown> = { ...FULL_ITEM, practice: [] };
    delete minimal['scene'];
    delete minimal['archived'];
    delete minimal['practiceSeconds'];
    delete minimal['sample'];
    expect(registration().validate?.([minimal])).toBe(true);
  });

  it('rejects malformed checks, practice entries and optional fields', () => {
    const fourChecks: Record<string, unknown> = { ...FULL_ITEM.checks };
    delete fourChecks['emotional'];
    expect(registration().validate?.([{ ...FULL_ITEM, checks: fourChecks }])).toBe(false);
    expect(
      registration().validate?.([{ ...FULL_ITEM, checks: { ...FULL_ITEM.checks, visual: 1 } }]),
    ).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, practice: [{ date: 3, seconds: 1 }] }])).toBe(
      false,
    );
    expect(registration().validate?.([{ ...FULL_ITEM, practice: [{ date: '2026-09-02' }] }])).toBe(
      false,
    );
    const withoutLog: Record<string, unknown> = { ...FULL_ITEM };
    delete withoutLog['practice'];
    expect(registration().validate?.([withoutLog])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, scene: 7 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, archived: 'yes' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, practiceSeconds: '60' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, text: null }])).toBe(false);
    expect(registration().validate?.({})).toBe(false);
  });

  it('accepts any practice length number: the offered lengths are a reader rule', () => {
    expect(registration().validate?.([{ ...FULL_ITEM, practiceSeconds: 45 }])).toBe(true);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h2: { affirmations: [FULL_ITEM] } } });
    expect(issues.filter((issue) => issue.path === AFFIRMATIONS_PATH)).toEqual([]);
  });
});
