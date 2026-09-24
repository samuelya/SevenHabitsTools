import { findHabit, HABIT_IDS, HABITS, isHabitId } from './habits';

describe('habits', () => {
  it('defines one hub per habit id, in order', () => {
    expect(HABITS.map((habit) => habit.id)).toEqual([...HABIT_IDS]);
  });

  it('recognises habit ids', () => {
    expect(isHabitId('h3')).toBe(true);
    expect(isHabitId('h8')).toBe(false);
    expect(isHabitId(undefined)).toBe(false);
  });

  it('finds a habit by id', () => {
    expect(findHabit('h2')?.titleKey).toBe('habits.h2.title');
    expect(findHabit('h2')?.shortTitleKey).toBe('habits.h2.shortTitle');
    expect(findHabit('nope')).toBeUndefined();
  });
});
