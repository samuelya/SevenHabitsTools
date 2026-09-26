import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { H2_ROLES_ID, H2_ROLES_ROUTE, registerRolesExercise } from './roles.model';

beforeEach(() => registerRolesExercise());

describe('h2-roles exercise registration', () => {
  it('registers on the Habit 2 hub at order 20 with its short title', () => {
    const entry = getRegisteredExercises().find((e) => e.exerciseId === H2_ROLES_ID);
    expect(entry).toEqual({
      exerciseId: 'h2-roles',
      habit: 'h2',
      titleKey: 'habits.exercises.h2-roles.title',
      shortTitleKey: 'habits.exercises.h2-roles.shortTitle',
      icon: 'diversity_3',
      route: H2_ROLES_ROUTE,
      order: 20,
      isStarted: expect.any(Function),
      statusFactory: expect.any(Function),
    });
    expect(H2_ROLES_ROUTE).toBe('habits/h2/roles');
  });
});
