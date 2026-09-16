import { TestBed } from '@angular/core/testing';
import { CLOCK } from '../../core/time/clock';
import './exercise-kit.model';
import { ExerciseProgress } from './exercise-progress.service';
import {
  registerExercise,
  resetExerciseRegistryForTesting,
  snapshotExerciseRegistryForTesting,
} from './exercise-registry';

const NOW = new Date('2026-01-02T10:00:00.000Z');

function setUp() {
  TestBed.configureTestingModule({
    providers: [{ provide: CLOCK, useValue: { now: () => NOW } }],
  });
  return TestBed.inject(ExerciseProgress);
}

describe('ExerciseProgress', () => {
  it('is not done before markDone is called', () => {
    const progress = setUp();

    expect(progress.isDone('h2-mission')()).toBe(false);
    expect(progress.completedAt('h2-mission')()).toBeNull();
  });

  it('is done, with a timestamp, after markDone', () => {
    const progress = setUp();

    progress.markDone('h2-mission');

    expect(progress.isDone('h2-mission')()).toBe(true);
    expect(progress.completedAt('h2-mission')()).toBe(NOW.toISOString());
  });

  it('is not done again after reopen', () => {
    const progress = setUp();
    progress.markDone('h2-mission');

    progress.reopen('h2-mission');

    expect(progress.isDone('h2-mission')()).toBe(false);
  });

  describe('progressFor', () => {
    let snapshot: ReturnType<typeof snapshotExerciseRegistryForTesting>;

    beforeEach(() => {
      snapshot = snapshotExerciseRegistryForTesting();
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
    });

    afterEach(() => resetExerciseRegistryForTesting(snapshot));

    it('counts done/total for the habit', () => {
      const progress = setUp();
      progress.markDone('h2-mission');

      expect(progress.progressFor('h2')()).toEqual({ done: 1, total: 2 });
    });
  });
});
