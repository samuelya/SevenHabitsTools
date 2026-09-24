import { ExerciseRegistryEntry } from '../../shared/exercise-kit/exercise-registry';
import { nextExercise } from './habit-hub.logic';

function entry(exerciseId: string, route: string): ExerciseRegistryEntry {
  return {
    exerciseId,
    habit: 'h2',
    titleKey: `${exerciseId}.title`,
    shortTitleKey: `${exerciseId}.shortTitle`,
    summaryKey: `${exerciseId}.summary`,
    icon: 'flag',
    route,
  };
}

describe('nextExercise', () => {
  it('is undefined when nothing is registered', () => {
    expect(nextExercise([], () => false)).toBeUndefined();
  });

  it('is the first registered exercise, in registration order, that is not done', () => {
    const exercises = [entry('mission', 'habits/h2/mission'), entry('roles', 'habits/h2/roles')];

    const next = nextExercise(exercises, (id) => id === 'mission');
    expect(next?.route).toBe('habits/h2/roles');
    expect(next?.shortTitleKey).toBe('roles.shortTitle');
  });

  it('is the first exercise when none are done yet', () => {
    const exercises = [entry('mission', 'habits/h2/mission'), entry('roles', 'habits/h2/roles')];

    expect(nextExercise(exercises, () => false)?.route).toBe('habits/h2/mission');
  });

  it('is undefined once every exercise is done', () => {
    const exercises = [entry('mission', 'habits/h2/mission'), entry('roles', 'habits/h2/roles')];

    expect(nextExercise(exercises, () => true)).toBeUndefined();
  });
});
