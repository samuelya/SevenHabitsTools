import { TestBed } from '@angular/core/testing';
import { featureStore } from '../../core/data/feature-store';
import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { signal } from '@angular/core';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { getMissionInputs } from '../../shared/mission-inputs/mission-inputs';
import {
  CENTRES_MODEL_KEY,
  CENTRES_PATH,
  CENTRES_ROUTE,
  CentreAssessment,
  registerCentresModel,
} from './centres.model';

// Vitest here runs with `isolate: false` (shared module state): re-assert, don't reset.
beforeEach(() => registerCentresModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === CENTRES_MODEL_KEY);
  if (!found) {
    throw new Error('h2-centres model was not registered');
  }
  return found;
}

const FULL: CentreAssessment = {
  id: 'c1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  date: '2026-09-01',
  ratings: { work: 3, money: 2, friends: 1, family: 0 },
  factors: { security: 'a', guidance: 'b', wisdom: 'c', power: 'd' },
  factorsCentre: 'work',
  principles: [{ key: 'integrity' }, { name: 'keeping my word' }],
};

describe('h2-centres model', () => {
  it('registers at habits.h2.centres with an empty default', () => {
    expect(registration().path).toBe(CENTRES_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise for Habit 2 at its route, third on the hub', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === CENTRES_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: CENTRES_MODEL_KEY,
      habit: 'h2',
      titleKey: 'habits.exercises.h2-centres.title',
      shortTitleKey: 'habits.exercises.h2-centres.shortTitle',
      icon: 'adjust',
      route: CENTRES_ROUTE,
      order: 30,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it("registers the newest complete assessment's principles as a mission input, labelled (issue #61 contract)", async () => {
    const inputs = getMissionInputs('principles').filter(
      (entry) => entry.sourceExerciseId === CENTRES_MODEL_KEY,
    );
    expect(inputs.length).toBe(1);

    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      ],
    });
    const items = TestBed.runInInjectionContext(() => {
      featureStore<CentreAssessment[]>(CENTRES_MODEL_KEY).update(() => [FULL]);
      return inputs[0].read();
    });
    await vi.waitFor(() =>
      expect(items()).toEqual([
        { id: 'integrity', text: 'Integrity', key: 'integrity' },
        { id: 'name:keeping my word', text: 'keeping my word' },
      ]),
    );
  });

  it('validates an empty array, a fully filled assessment and one without factors', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL])).toBe(true);
    const withoutFactors: Record<string, unknown> = { ...FULL };
    delete withoutFactors['factors'];
    expect(registration().validate?.([withoutFactors])).toBe(true);
  });

  it('rejects an unknown centre, a rating outside 0–3, an unknown principle, factor or factors centre', () => {
    const reject = (value: unknown) => expect(registration().validate?.([value])).toBe(false);
    reject({ ...FULL, ratings: { career: 2 } });
    reject({ ...FULL, ratings: { work: '3' } });
    // Integers 0–3 only.
    reject({ ...FULL, ratings: { work: 7 } });
    reject({ ...FULL, ratings: { work: -1 } });
    reject({ ...FULL, ratings: { work: 1.5 } });
    reject({ ...FULL, factorsCentre: 'career' });
    reject({ ...FULL, principles: [{ key: 'wealth' }] });
    reject({ ...FULL, principles: [{ name: 3 }] });
    reject({ ...FULL, principles: 'integrity' });
    reject({ ...FULL, factors: { mood: 'x' } });
    reject({ ...FULL, factors: { power: 1 } });
    const withoutDate: Record<string, unknown> = { ...FULL };
    delete withoutDate['date'];
    reject(withoutDate);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h2: { centres: [FULL] } } });
    expect(issues.filter((issue) => issue.path === CENTRES_PATH)).toEqual([]);
  });
});
