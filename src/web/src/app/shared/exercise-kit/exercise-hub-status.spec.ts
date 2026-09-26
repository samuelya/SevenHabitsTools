import { Injector, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { TestBed } from '@angular/core/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
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

describe('exerciseStatusSignal keyParams (issue #60)', () => {
  const centre = (key: string): ExerciseHubStatus => ({
    key: 'k',
    count: 1,
    params: { total: 3 },
    keyParams: { centre: { scope: 'h2-centres', key: `centre.${key}.title` } },
  });

  function setUpWithTransloco(): Injector {
    registerExerciseKitModel();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      ],
    });
    return TestBed.inject(Injector);
  }

  async function settled(read: () => unknown, expected: unknown): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(read()).toEqual(expected);
    });
  }

  it('translates each key param from its scope into params, and follows the status and language', async () => {
    const injector = setUpWithTransloco();
    const source = signal<ExerciseHubStatus | null>(centre('work'));
    const status = exerciseStatusSignal(entry({ statusFactory: () => source }), injector);

    // Nothing until the translation is in: never a blank name.
    expect(status()).toBeNull();
    await settled(status, { key: 'k', count: 1, params: { total: 3, centre: 'Work' } });

    // Another centre never shows the previous one's name while it loads.
    source.set(centre('money'));
    expect(status()).toBeNull();
    await settled(status, { key: 'k', count: 1, params: { total: 3, centre: 'Money' } });

    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settled(status, { key: 'k', count: 1, params: { total: 3, centre: 'المال' } });

    source.set(null);
    expect(status()).toBeNull();
  });

  it('passes a status without keyParams through at once', () => {
    const injector = setUpWithTransloco();
    const status = exerciseStatusSignal(
      entry({ statusFactory: () => signal({ key: 'k', count: 2 }) }),
      injector,
    );
    expect(status()).toEqual({ key: 'k', count: 2 });
  });

  it('can be created lazily inside a computed, as the hub and Today do (NG0602)', () => {
    const injector = setUpWithTransloco();
    const lazy = computed(() =>
      exerciseStatusSignal(entry({ statusFactory: () => signal(centre('work')) }), injector)(),
    );
    expect(() => lazy()).not.toThrow();
  });
});
