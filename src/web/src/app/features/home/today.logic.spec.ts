import { HABITS, HabitId } from '../../core/habits/habits';
import { ExerciseRegistryEntry } from '../../shared/exercise-kit/exercise-registry';
import { todayContinueTarget } from './today.logic';

function entry(exerciseId: string, habit: HabitId, order?: number): ExerciseRegistryEntry {
  return {
    exerciseId,
    habit,
    titleKey: `${exerciseId}.title`,
    shortTitleKey: `${exerciseId}.shortTitle`,
    icon: 'flag',
    route: `habits/${habit}/${exerciseId}`,
    ...(order === undefined ? {} : { order }),
  };
}

describe('todayContinueTarget (#220)', () => {
  const registry = [
    entry('mission', 'h2', 10),
    entry('transition', 'paradigms', 20),
    entry('perception', 'paradigms', 10),
  ];

  function target(done: readonly string[]) {
    const result = todayContinueTarget(HABITS, registry, (id) => done.includes(id));
    return result && `${result.habit.id}/${result.exercise.exerciseId}`;
  }

  it('starts from the first habit with any exercise, in chapter order', () => {
    expect(target([])).toBe('paradigms/perception');
    expect(target(['perception'])).toBe('paradigms/transition');
  });

  it('moves to the next habit with exercises once a habit is done, skipping empty habits', () => {
    expect(target(['perception', 'transition'])).toBe('h2/mission');
  });

  it('is undefined once every registered exercise is done', () => {
    expect(target(['perception', 'transition', 'mission'])).toBeUndefined();
  });

  it('is undefined with no registered exercises', () => {
    expect(todayContinueTarget(HABITS, [], () => false)).toBeUndefined();
  });
});
