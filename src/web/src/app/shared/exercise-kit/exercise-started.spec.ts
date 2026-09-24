import { Injector, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import {
  EXERCISE_COMPLETIONS_MODEL_KEY,
  ExerciseCompletion,
  registerExerciseKitModel,
} from './exercise-kit.model';
import { ExerciseRegistryEntry } from './exercise-registry';
import { exerciseStartedSignal, storeStartedFactory } from './exercise-started';

const NOW = '2026-01-01T00:00:00.000Z';

function entry(overrides: Partial<ExerciseRegistryEntry> = {}): ExerciseRegistryEntry {
  return {
    exerciseId: 'test-exercise',
    habit: 'paradigms',
    titleKey: 'title',
    shortTitleKey: 'title',
    summaryKey: 'summary',
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

const hasAny = (value: readonly ExerciseCompletion[]): boolean => value.length > 0;

describe('exerciseStartedSignal (issue #216)', () => {
  it('reads an entry without isStarted as not started', () => {
    const injector = setUp();
    expect(exerciseStartedSignal(entry(), injector)()).toBe(false);
  });

  it("calls the entry's factory in the injector's context", () => {
    const injector = setUp();
    const factory = vi.fn(() => {
      // `inject()` throws outside an injection context: proves the factory ran inside one.
      inject(Injector);
      return signal(true);
    });

    expect(exerciseStartedSignal(entry({ isStarted: factory }), injector)()).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('storeStartedFactory (issue #216)', () => {
  it("follows the predicate over the model's live store value", () => {
    const injector = setUp();
    const started = exerciseStartedSignal(
      entry({ isStarted: storeStartedFactory(EXERCISE_COMPLETIONS_MODEL_KEY, hasAny) }),
      injector,
    );
    expect(started()).toBe(false);

    TestBed.runInInjectionContext(() =>
      featureStore<ExerciseCompletion[]>(EXERCISE_COMPLETIONS_MODEL_KEY).update(() => [
        { id: 'c1', createdAt: NOW, updatedAt: NOW, exerciseId: 'x', completedAt: NOW },
      ]),
    );

    expect(started()).toBe(true);
  });

  it('reads as not started, rather than throwing, when the model is not registered', () => {
    const injector = setUp();
    const started = exerciseStartedSignal(
      entry({ isStarted: storeStartedFactory('no-such-model', () => true) }),
      injector,
    );
    expect(started()).toBe(false);
  });
});
