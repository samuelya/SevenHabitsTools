import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { getMissionInputs } from '../../shared/mission-inputs/mission-inputs';
import {
  LONG_VIEW_MODEL_KEY,
  LONG_VIEW_PATH,
  LONG_VIEW_ROUTE,
  LongView,
  registerLongViewModel,
} from './long-view.model';

// Vitest here runs with `isolate: false` (shared module state): re-assert, don't reset.
beforeEach(() => registerLongViewModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === LONG_VIEW_MODEL_KEY);
  if (!found) {
    throw new Error('h2-long-view model was not registered');
  }
  return found;
}

const FULL_VIEW: LongView = {
  id: 'lv1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  scenario: 'funeral',
  date: '2026-09-01',
  answers: [
    { promptKey: 'funeral.family', text: 'Home for dinner.', values: ['presence'] },
    { promptKey: 'funeral.friend', speaker: 'Sam', text: 'Came at 2 a.m.', values: ['loyalty'] },
    { promptKey: 'funeral.work', text: '', values: [] },
    { promptKey: 'funeral.community', text: 'Showed up.', values: [] },
  ],
  reflection: 'Nobody mentioned my title.',
};

describe('h2-long-view model', () => {
  it('registers at habits.h2.longViews with an empty default', () => {
    expect(registration().path).toBe(LONG_VIEW_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise for Habit 2 at its route, first on the hub', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === LONG_VIEW_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: LONG_VIEW_MODEL_KEY,
      habit: 'h2',
      titleKey: 'habits.exercises.h2-long-view.title',
      shortTitleKey: 'habits.exercises.h2-long-view.shortTitle',
      icon: 'landscape',
      route: LONG_VIEW_ROUTE,
      order: 10,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('registers its values as a mission input (issue #61 contract)', () => {
    const inputs = getMissionInputs('values').filter(
      (entry) => entry.sourceExerciseId === LONG_VIEW_MODEL_KEY,
    );
    expect(inputs.length).toBe(1);
  });

  it('validates an empty array and a fully filled long view', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL_VIEW])).toBe(true);
    const withoutReflection: Record<string, unknown> = { ...FULL_VIEW };
    delete withoutReflection['reflection'];
    expect(registration().validate?.([withoutReflection])).toBe(true);
  });

  it('rejects an unknown scenario, a missing date or a malformed answer', () => {
    expect(registration().validate?.([{ ...FULL_VIEW, scenario: 'wedding' }])).toBe(false);
    const withoutDate: Record<string, unknown> = { ...FULL_VIEW };
    delete withoutDate['date'];
    expect(registration().validate?.([withoutDate])).toBe(false);
    expect(
      registration().validate?.([
        { ...FULL_VIEW, answers: [{ promptKey: 'funeral.family', text: 'x', values: 'presence' }] },
      ]),
    ).toBe(false);
    expect(
      registration().validate?.([
        {
          ...FULL_VIEW,
          answers: [{ promptKey: 'funeral.family', speaker: 3, text: '', values: [] }],
        },
      ]),
    ).toBe(false);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h2: { longViews: [FULL_VIEW] } } });
    expect(issues.filter((issue) => issue.path === LONG_VIEW_PATH)).toEqual([]);
  });
});
