import {
  ExerciseRegistryEntry,
  exercisesForHabit,
  getRegisteredExercises,
  registerExercise,
  resetExerciseRegistryForTesting,
  snapshotExerciseRegistryForTesting,
  sortByOrder,
} from './exercise-registry';

describe('exercise-registry', () => {
  let snapshot: ReturnType<typeof snapshotExerciseRegistryForTesting>;

  beforeEach(() => {
    snapshot = snapshotExerciseRegistryForTesting();
  });

  afterEach(() => {
    resetExerciseRegistryForTesting(snapshot);
  });

  it('returns registered exercises in registration order', () => {
    resetExerciseRegistryForTesting();
    registerExercise({
      exerciseId: 'h2-mission',
      habit: 'h2',
      titleKey: 'mission.title',
      shortTitleKey: 'mission.shortTitle',
      icon: 'flag',
      route: 'habits/h2/mission',
    });
    registerExercise({
      exerciseId: 'h2-roles',
      habit: 'h2',
      titleKey: 'roles.title',
      shortTitleKey: 'roles.shortTitle',
      icon: 'flag',
      route: 'habits/h2/roles',
    });

    expect(getRegisteredExercises().map((e) => e.exerciseId)).toEqual(['h2-mission', 'h2-roles']);
  });

  it('throws when the same exerciseId is registered twice', () => {
    resetExerciseRegistryForTesting();
    registerExercise({
      exerciseId: 'h2-mission',
      habit: 'h2',
      titleKey: 'mission.title',
      shortTitleKey: 'mission.shortTitle',
      icon: 'flag',
      route: 'habits/h2/mission',
    });

    expect(() =>
      registerExercise({
        exerciseId: 'h2-mission',
        habit: 'h2',
        titleKey: 'other',
        shortTitleKey: 'other',
        icon: 'flag',
        route: 'other',
      }),
    ).toThrow('"h2-mission"');
  });

  it('throws when the same route is registered by a different exerciseId', () => {
    resetExerciseRegistryForTesting();
    registerExercise({
      exerciseId: 'h2-mission',
      habit: 'h2',
      titleKey: 'mission.title',
      shortTitleKey: 'mission.shortTitle',
      icon: 'flag',
      route: 'habits/h2/mission',
    });

    expect(() =>
      registerExercise({
        exerciseId: 'h2-roles',
        habit: 'h2',
        titleKey: 'roles.title',
        shortTitleKey: 'roles.shortTitle',
        icon: 'flag',
        route: 'habits/h2/mission',
      }),
    ).toThrow('"habits/h2/mission"');
  });
});

describe('sortByOrder / exercisesForHabit (#219)', () => {
  function entry(exerciseId: string, order?: number, habit: 'h1' | 'h2' = 'h2') {
    const base: ExerciseRegistryEntry = {
      exerciseId,
      habit,
      titleKey: `${exerciseId}.title`,
      shortTitleKey: `${exerciseId}.shortTitle`,
      icon: 'flag',
      route: `habits/${habit}/${exerciseId}`,
    };
    return order === undefined ? base : { ...base, order };
  }

  it('sorts by order, lowest first', () => {
    const sorted = sortByOrder([entry('c', 30), entry('a', 10), entry('b', 20)]);
    expect(sorted.map((e) => e.exerciseId)).toEqual(['a', 'b', 'c']);
  });

  it('puts entries without an order last, in their given (registration) order', () => {
    const sorted = sortByOrder([entry('x'), entry('b', 20), entry('y'), entry('a', 10)]);
    expect(sorted.map((e) => e.exerciseId)).toEqual(['a', 'b', 'x', 'y']);
  });

  it('keeps the given order for equal orders and when nothing has an order', () => {
    expect(sortByOrder([entry('b', 5), entry('a', 5)]).map((e) => e.exerciseId)).toEqual([
      'b',
      'a',
    ]);
    expect(sortByOrder([entry('b'), entry('a')]).map((e) => e.exerciseId)).toEqual(['b', 'a']);
  });

  it('does not mutate its input', () => {
    const input = [entry('b', 2), entry('a', 1)];
    sortByOrder(input);
    expect(input.map((e) => e.exerciseId)).toEqual(['b', 'a']);
  });

  it('filters to one habit and returns it in chapter order', () => {
    const registry = [entry('late', 20), entry('other', 1, 'h1'), entry('early', 10)];
    expect(exercisesForHabit(registry, 'h2').map((e) => e.exerciseId)).toEqual(['early', 'late']);
  });
});
