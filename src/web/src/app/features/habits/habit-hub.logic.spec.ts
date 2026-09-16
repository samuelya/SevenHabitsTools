import { ExerciseRegistryEntry } from '../../shared/exercise-kit/exercise-registry';
import { nextExerciseRoute } from './habit-hub.logic';

function entry(exerciseId: string, route: string): ExerciseRegistryEntry {
  return {
    exerciseId,
    habit: 'h2',
    titleKey: `${exerciseId}.title`,
    summaryKey: `${exerciseId}.summary`,
    icon: 'flag',
    route,
  };
}

describe('nextExerciseRoute', () => {
  it('is undefined when nothing is registered', () => {
    expect(nextExerciseRoute([], () => false)).toBeUndefined();
  });

  it('is the first registered exercise, in registration order, that is not done', () => {
    const exercises = [entry('mission', 'habits/h2/mission'), entry('roles', 'habits/h2/roles')];

    expect(nextExerciseRoute(exercises, (id) => id === 'mission')).toBe('habits/h2/roles');
  });

  it('is the first exercise when none are done yet', () => {
    const exercises = [entry('mission', 'habits/h2/mission'), entry('roles', 'habits/h2/roles')];

    expect(nextExerciseRoute(exercises, () => false)).toBe('habits/h2/mission');
  });

  it('is undefined once every exercise is done', () => {
    const exercises = [entry('mission', 'habits/h2/mission'), entry('roles', 'habits/h2/roles')];

    expect(nextExerciseRoute(exercises, () => true)).toBeUndefined();
  });
});
