import {
  getRegisteredExercises,
  registerExercise,
  resetExerciseRegistryForTesting,
  snapshotExerciseRegistryForTesting,
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
      route: 'habits/h2/mission',
    });
    registerExercise({
      exerciseId: 'h2-roles',
      habit: 'h2',
      titleKey: 'roles.title',
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
      route: 'habits/h2/mission',
    });

    expect(() =>
      registerExercise({
        exerciseId: 'h2-mission',
        habit: 'h2',
        titleKey: 'other',
        route: 'other',
      }),
    ).toThrow('"h2-mission"');
  });
});
