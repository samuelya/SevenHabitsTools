import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  REHEARSAL_MODEL_KEY,
  REHEARSAL_PATH,
  Rehearsal,
  registerRehearsalModel,
} from './rehearsal.model';

// Vitest runs with `isolate: false`: re-assert the registration instead of resetting it.
beforeEach(() => registerRehearsalModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === REHEARSAL_MODEL_KEY);
  if (!found) {
    throw new Error('h1-rehearsal model was not registered');
  }
  return found;
}

const FULL: Rehearsal = {
  id: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  trigger: 'Sunday lunch, when Dad brings up my job again.',
  expectedOn: '2026-01-04',
  usualReaction: 'I get short with him.',
  cost: 'The afternoon is ruined.',
  chosenResponse: 'I take a breath and ask him one question back.',
  promise: 'Answer calmly.',
  commitmentId: 'p1',
  followUp: { happened: true, result: 'partly', kept: 'kept', learned: 'The breath helped.' },
  sample: false,
};

describe('h1-rehearsal model', () => {
  it('registers at habits.h1.rehearsals with an empty default', () => {
    expect(registration().path).toBe(REHEARSAL_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise on the Habit 1 hub at order 20', () => {
    const entry = getRegisteredExercises().find((e) => e.exerciseId === REHEARSAL_MODEL_KEY);
    expect(entry).toEqual({
      exerciseId: REHEARSAL_MODEL_KEY,
      habit: 'h1',
      titleKey: 'habits.exercises.h1-rehearsal.title',
      shortTitleKey: 'habits.exercises.h1-rehearsal.shortTitle',
      icon: 'theater_comedy',
      route: 'habits/h1/rehearsal',
      order: 20,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('validates an empty array, a full rehearsal, a minimal one and a "Not yet" follow-up', () => {
    const minimal: Rehearsal = {
      id: 'r2',
      createdAt: FULL.createdAt,
      updatedAt: FULL.updatedAt,
      trigger: '',
    };
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL, minimal])).toBe(true);
    expect(registration().validate?.([{ ...minimal, followUp: { happened: false } }])).toBe(true);
  });

  it('rejects a missing trigger, a wrong field type and an unknown enum value', () => {
    const withoutTrigger: Record<string, unknown> = { ...FULL };
    delete withoutTrigger['trigger'];
    expect(registration().validate?.([withoutTrigger])).toBe(false);
    expect(registration().validate?.([{ ...FULL, promise: 3 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, commitmentId: 1 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, sample: 'yes' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, followUp: { happened: 'yes' } }])).toBe(false);
    expect(
      registration().validate?.([{ ...FULL, followUp: { happened: true, result: 'fine' } }]),
    ).toBe(false);
    expect(
      registration().validate?.([{ ...FULL, followUp: { happened: true, kept: 'maybe' } }]),
    ).toBe(false);
    expect(registration().validate?.([{ ...FULL, followUp: [] }])).toBe(false);
  });

  it('rejects a date that is not a real YYYY-MM-DD date', () => {
    expect(registration().validate?.([{ ...FULL, expectedOn: '2026-13-01' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, expectedOn: '' }])).toBe(false);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h1: { rehearsals: [FULL] } } });
    expect(issues.filter((issue) => issue.path === REHEARSAL_PATH)).toEqual([]);
  });
});
