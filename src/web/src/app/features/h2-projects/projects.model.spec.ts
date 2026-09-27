import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { PROJECTS_MODEL_KEY } from '../../shared/projects/projects.model';
import { PROJECTS_ROUTE, registerProjectsExercise } from './projects.model';

// Vitest here runs with `isolate: false` (shared module state): re-assert, don't reset.
beforeEach(() => registerProjectsExercise());

describe('h2-projects exercise', () => {
  it('registers the exercise at order 70 on the Habit 2 hub with its short title', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === PROJECTS_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: 'h2-projects',
      habit: 'h2',
      titleKey: 'habits.exercises.h2-projects.title',
      shortTitleKey: 'habits.exercises.h2-projects.shortTitle',
      icon: 'flag',
      route: PROJECTS_ROUTE,
      order: 70,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
    expect(PROJECTS_ROUTE).toBe('habits/h2/projects');
  });
});
