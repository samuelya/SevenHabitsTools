import { HABITS, HabitId } from '../../core/habits/habits';
import { habitListLayout, laterLabel, progressPercentage } from './habits.logic';

describe('progressPercentage', () => {
  it('is 0 when there are no exercises', () => {
    expect(progressPercentage(0, 0)).toBe(0);
  });

  it('rounds to the nearest whole percentage', () => {
    expect(progressPercentage(1, 3)).toBe(33);
  });

  it('is 100 when every exercise is done', () => {
    expect(progressPercentage(4, 4)).toBe(100);
  });
});

describe('habitListLayout (#219)', () => {
  function layoutWith(available: readonly HabitId[]) {
    const layout = habitListLayout(HABITS, (habit) => available.includes(habit));
    return {
      shown: layout.shown.map((row) => `${row.habit.id}:${row.state}`),
      later: layout.later.map((habit) => habit.id),
    };
  }

  it('with only Paradigms available: one available row, Habit 1 next up, the rest later', () => {
    expect(layoutWith(['paradigms'])).toEqual({
      shown: ['paradigms:available', 'h1:nextUp'],
      later: ['h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'interdependence'],
    });
  });

  it('picks the first empty habit after an available one as next up, keeping book order', () => {
    expect(layoutWith(['paradigms', 'h1', 'h3'])).toEqual({
      shown: ['paradigms:available', 'h1:available', 'h2:nextUp', 'h3:available'],
      later: ['h4', 'h5', 'h6', 'h7', 'interdependence'],
    });
  });

  it('shows the first habit as next up when none is available yet', () => {
    expect(layoutWith([])).toEqual({
      shown: ['paradigms:nextUp'],
      later: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'interdependence'],
    });
  });

  it('has nothing later once every habit is available', () => {
    const all = HABITS.map((habit) => habit.id);
    expect(layoutWith(all).later).toEqual([]);
  });
});

describe('laterLabel (#219)', () => {
  it('names a run of numbered habits plus Interdependence as a range', () => {
    expect(laterLabel(['h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'interdependence'])).toEqual({
      key: 'habits.list.laterRange',
      count: 7,
      params: { from: 2, to: 7 },
      plural: false,
    });
  });

  it('falls back to a count for anything else', () => {
    const count = { key: 'habits.list.laterCount', params: {}, plural: true };
    expect(laterLabel(['h2', 'h4', 'interdependence'])).toEqual({ ...count, count: 3 });
    expect(laterLabel(['h6', 'h7'])).toEqual({ ...count, count: 2 });
    expect(laterLabel(['h7', 'interdependence'])).toEqual({ ...count, count: 2 });
  });
});
