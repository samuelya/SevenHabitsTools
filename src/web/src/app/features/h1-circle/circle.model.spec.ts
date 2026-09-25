import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { CIRCLE_MODEL_KEY, CIRCLE_PATH, Concern, registerCircleModel } from './circle.model';

// Vitest runs with `isolate: false`: re-assert the registration instead of resetting it.
beforeEach(() => registerCircleModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === CIRCLE_MODEL_KEY);
  if (!found) {
    throw new Error('h1-circle model was not registered');
  }
  return found;
}

const FULL_CONCERN: Concern = {
  id: 'c1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  title: 'My manager keeps changing the deadline.',
  control: 'indirect',
  have: 'a manager who plans ahead.',
  be: 'clear about what a change costs.',
  firstStep: 'Ask for a 10-minute chat.',
  dueDate: '2026-01-08',
  letGoNote: 'Kept from an earlier branch.',
  status: 'stepTaken',
  commitmentId: 'p1',
  sample: false,
};

describe('h1-circle model', () => {
  it('registers at habits.h1.concerns with an empty default', () => {
    expect(registration().path).toBe(CIRCLE_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise on the Habit 1 hub at order 30', () => {
    const entry = getRegisteredExercises().find((e) => e.exerciseId === CIRCLE_MODEL_KEY);
    expect(entry).toEqual({
      exerciseId: CIRCLE_MODEL_KEY,
      habit: 'h1',
      titleKey: 'habits.exercises.h1-circle.title',
      shortTitleKey: 'habits.exercises.h1-circle.shortTitle',
      icon: 'track_changes',
      route: 'habits/h1/circle',
      order: 30,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('validates an empty array, a full concern and a minimal one', () => {
    const minimal: Concern = {
      id: 'c2',
      createdAt: FULL_CONCERN.createdAt,
      updatedAt: FULL_CONCERN.updatedAt,
      title: '',
      control: 'none',
      status: 'open',
    };
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL_CONCERN, minimal])).toBe(true);
  });

  it('rejects a missing title, an unknown control or status, and a wrong field type', () => {
    const withoutTitle: Record<string, unknown> = { ...FULL_CONCERN };
    delete withoutTitle['title'];
    expect(registration().validate?.([withoutTitle])).toBe(false);
    expect(registration().validate?.([{ ...FULL_CONCERN, control: 'some' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_CONCERN, status: 'done' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_CONCERN, firstStep: 3 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_CONCERN, commitmentId: 1 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_CONCERN, sample: 'yes' }])).toBe(false);
  });

  it('rejects a due date that is not a real YYYY-MM-DD date', () => {
    expect(registration().validate?.([{ ...FULL_CONCERN, dueDate: '2026-13-01' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_CONCERN, dueDate: '' }])).toBe(false);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h1: { concerns: [FULL_CONCERN] } } });
    expect(issues.filter((issue) => issue.path === CIRCLE_PATH)).toEqual([]);
  });
});
