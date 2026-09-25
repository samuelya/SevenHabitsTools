import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  H1_COMMITMENTS_ID,
  H1_COMMITMENTS_ROUTE,
  registerCommitmentsExercise,
} from './commitments.model';

beforeEach(() => registerCommitmentsExercise());

describe('h1-commitments exercise registration', () => {
  it('registers on the Habit 1 hub at order 50 with its short title', () => {
    const entry = getRegisteredExercises().find((e) => e.exerciseId === H1_COMMITMENTS_ID);
    expect(entry).toEqual({
      exerciseId: 'h1-commitments',
      habit: 'h1',
      titleKey: 'habits.exercises.h1-commitments.title',
      shortTitleKey: 'habits.exercises.h1-commitments.shortTitle',
      icon: 'handshake',
      route: H1_COMMITMENTS_ROUTE,
      order: 50,
      isStarted: expect.any(Function),
      statusFactory: expect.any(Function),
    });
    expect(H1_COMMITMENTS_ROUTE).toBe('habits/h1/commitments');
  });
});
