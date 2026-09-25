import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  CHALLENGE_MODEL_KEY,
  CHALLENGE_PATH,
  Challenge,
  registerChallengeModel,
} from './challenge.model';

// Vitest runs with `isolate: false`: re-assert the registration instead of resetting it.
beforeEach(() => registerChallengeModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === CHALLENGE_MODEL_KEY);
  if (!found) {
    throw new Error('h1-challenge model was not registered');
  }
  return found;
}

const FULL: Challenge = {
  id: 'c1',
  createdAt: '2026-03-01T08:00:00.000Z',
  updatedAt: '2026-03-30T20:00:00.000Z',
  startDate: '2026-03-01',
  focus: 'How I talk to my teenager.',
  status: 'completed',
  endedOn: '2026-03-30',
  checkins: [
    {
      date: '2026-03-01',
      answers: { influence: true, promise: true, response: false, noBlame: true },
      note: 'Asked what we could change instead.',
    },
    { date: '2026-03-02', skipped: true, skipReason: 'Ill in bed all day.' },
  ],
  midNote: 'I catch myself faster.',
  finalNote: 'Fewer arguments.',
};

describe('h1-challenge model', () => {
  it('registers at habits.h1.challenges with an empty default', () => {
    expect(registration().path).toBe(CHALLENGE_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise on the Habit 1 hub at order 40', () => {
    const entry = getRegisteredExercises().find((e) => e.exerciseId === CHALLENGE_MODEL_KEY);
    expect(entry).toEqual({
      exerciseId: CHALLENGE_MODEL_KEY,
      habit: 'h1',
      titleKey: 'habits.exercises.h1-challenge.title',
      shortTitleKey: 'habits.exercises.h1-challenge.shortTitle',
      icon: 'event_available',
      route: 'habits/h1/challenge',
      order: 40,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('validates an empty array, a full test and a minimal running one', () => {
    const minimal: Challenge = {
      id: 'c2',
      createdAt: FULL.createdAt,
      updatedAt: FULL.updatedAt,
      startDate: '2026-04-01',
      status: 'active',
      checkins: [],
    };
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL, minimal])).toBe(true);
  });

  it('rejects a wrong shape, an unknown status and a bad check-in', () => {
    const withoutCheckins: Record<string, unknown> = { ...FULL };
    delete withoutCheckins['checkins'];
    expect(registration().validate?.([withoutCheckins])).toBe(false);
    expect(registration().validate?.([{ ...FULL, status: 'paused' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, focus: 3 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, checkins: [{ skipped: true }] }])).toBe(false);
    expect(
      registration().validate?.([
        { ...FULL, checkins: [{ date: '2026-03-01', answers: { influence: true } }] },
      ]),
    ).toBe(false);
    expect(
      registration().validate?.([{ ...FULL, checkins: [{ date: '2026-03-01', skipped: 'yes' }] }]),
    ).toBe(false);
    expect(registration().validate?.({})).toBe(false);
  });

  it('rejects a date that is not a real YYYY-MM-DD date', () => {
    expect(registration().validate?.([{ ...FULL, startDate: '' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, endedOn: '2026-13-01' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, checkins: [{ date: '2026-02-30' }] }])).toBe(
      false,
    );
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h1: { challenges: [FULL] } } });
    expect(issues.filter((issue) => issue.path === CHALLENGE_PATH)).toEqual([]);
  });
});
