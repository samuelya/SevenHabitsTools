import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import {
  EXERCISE_COMPLETIONS_MODEL_KEY,
  ExerciseCompletion,
  registerExerciseKitModel,
} from '../exercise-kit/exercise-kit.model';
import {
  MissionInputItem,
  getMissionInputs,
  registerMissionInput,
  storeInputFactory,
} from './mission-inputs';

const NOW = '2026-01-01T00:00:00.000Z';

function setUp(): void {
  // Vitest here runs with `isolate: false` (shared module state) — see `exercise-kit.model.spec.ts`.
  registerExerciseKitModel();
  TestBed.configureTestingModule({
    providers: [
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
}

const idsOf = (value: readonly ExerciseCompletion[]): readonly MissionInputItem[] =>
  value.map((completion) => ({ id: completion.id, text: completion.exerciseId }));

describe('mission inputs registry (issue #61 contract)', () => {
  it('lists entries by kind and ignores a repeated registration', () => {
    const read = () => signal<readonly MissionInputItem[]>([]);
    registerMissionInput({ sourceExerciseId: 'spec-source', kind: 'principles', read });
    registerMissionInput({ sourceExerciseId: 'spec-source', kind: 'principles', read });
    registerMissionInput({ sourceExerciseId: 'spec-source', kind: 'inspiration', read });

    const principles = getMissionInputs('principles').filter(
      (entry) => entry.sourceExerciseId === 'spec-source',
    );
    expect(principles.length).toBe(1);
    expect(principles[0].read).toBe(read);
    expect(
      getMissionInputs('inspiration').some((entry) => entry.sourceExerciseId === 'spec-source'),
    ).toBe(true);
  });

  it("storeInputFactory follows pick over the model's live store value", () => {
    setUp();
    const items = TestBed.runInInjectionContext(
      storeInputFactory(EXERCISE_COMPLETIONS_MODEL_KEY, idsOf),
    );
    expect(items()).toEqual([]);

    TestBed.runInInjectionContext(() =>
      featureStore<ExerciseCompletion[]>(EXERCISE_COMPLETIONS_MODEL_KEY).update(() => [
        { id: 'c1', createdAt: NOW, updatedAt: NOW, exerciseId: 'x', completedAt: NOW },
      ]),
    );

    expect(items()).toEqual([{ id: 'c1', text: 'x' }]);
  });

  it('storeInputFactory reads as no items when the model is not registered', () => {
    setUp();
    const items = TestBed.runInInjectionContext(
      storeInputFactory('no-such-model', () => [{ id: 'a', text: 'a' }]),
    );
    expect(items()).toEqual([]);
  });
});
