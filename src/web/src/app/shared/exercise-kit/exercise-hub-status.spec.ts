import { Injector, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { exerciseStatusSignal, storeStatusFactory } from './exercise-hub-status';
import {
  EXERCISE_COMPLETIONS_MODEL_KEY,
  ExerciseCompletion,
  registerExerciseKitModel,
} from './exercise-kit.model';
import { ExerciseHubStatus, ExerciseRegistryEntry } from './exercise-registry';

const NOW = '2026-01-01T00:00:00.000Z';

function entry(overrides: Partial<ExerciseRegistryEntry> = {}): ExerciseRegistryEntry {
  return {
    exerciseId: 'test-exercise',
    habit: 'paradigms',
    titleKey: 'title',
    shortTitleKey: 'title',
    icon: 'star',
    route: 'habits/paradigms/test',
    ...overrides,
  };
}

function setUp(): Injector {
  // Vitest here runs with `isolate: false` (shared module state) — see `exercise-kit.model.spec.ts`.
  registerExerciseKitModel();
  TestBed.configureTestingModule({
    providers: [
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  return TestBed.inject(Injector);
}

const countOf = (value: readonly ExerciseCompletion[]): ExerciseHubStatus | null =>
  value.length > 0 ? { key: 'count', count: value.length } : null;

describe('exerciseStatusSignal (issue #219)', () => {
  it('reads an entry without statusFactory as no status', () => {
    const injector = setUp();
    expect(exerciseStatusSignal(entry(), injector)()).toBeNull();
  });

  it("calls the entry's factory in the injector's context", () => {
    const injector = setUp();
    const factory = vi.fn(() => {
      // `inject()` throws outside an injection context: proves the factory ran inside one.
      inject(Injector);
      return signal<ExerciseHubStatus | null>({ key: 'k', count: 1 });
    });

    expect(exerciseStatusSignal(entry({ statusFactory: factory }), injector)()).toEqual({
      key: 'k',
      count: 1,
    });
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('storeStatusFactory (issue #219)', () => {
  it("follows the status function over the model's live store value", () => {
    const injector = setUp();
    const status = exerciseStatusSignal(
      entry({ statusFactory: storeStatusFactory(EXERCISE_COMPLETIONS_MODEL_KEY, countOf) }),
      injector,
    );
    expect(status()).toBeNull();

    TestBed.runInInjectionContext(() =>
      featureStore<ExerciseCompletion[]>(EXERCISE_COMPLETIONS_MODEL_KEY).update(() => [
        { id: 'c1', createdAt: NOW, updatedAt: NOW, exerciseId: 'x', completedAt: NOW },
      ]),
    );

    expect(status()).toEqual({ key: 'count', count: 1 });
  });

  it('reads as no status, rather than throwing, when the model is not registered', () => {
    const injector = setUp();
    const status = exerciseStatusSignal(
      entry({ statusFactory: storeStatusFactory('no-such-model', () => ({ key: 'k', count: 1 })) }),
      injector,
    );
    expect(status()).toBeNull();
  });
});
