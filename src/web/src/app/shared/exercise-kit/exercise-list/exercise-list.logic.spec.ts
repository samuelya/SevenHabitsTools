import { ExerciseListItem, filterExerciseItems, sortExerciseItems } from './exercise-list.logic';

const ITEMS: ExerciseListItem[] = [
  { id: 'b', title: 'Begin with the end', subtitle: 'Mission statement', done: false },
  { id: 'a', title: 'Be proactive', subtitle: 'Circle of influence', done: true },
  { id: 'c', title: 'Circle of concern', done: false },
];

describe('filterExerciseItems', () => {
  it('returns every item for a blank query', () => {
    expect(filterExerciseItems(ITEMS, '  ')).toHaveLength(3);
  });

  it('matches on title, case-insensitively', () => {
    expect(filterExerciseItems(ITEMS, 'PROACTIVE').map((item) => item.id)).toEqual(['a']);
  });

  it('matches on subtitle', () => {
    expect(filterExerciseItems(ITEMS, 'mission').map((item) => item.id)).toEqual(['b']);
  });

  it('matches nothing when no item has the query', () => {
    expect(filterExerciseItems(ITEMS, 'zzz')).toEqual([]);
  });
});

describe('sortExerciseItems', () => {
  it('sorts alphabetically by title', () => {
    expect(sortExerciseItems(ITEMS, 'title').map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts not-done items first, alphabetically within each group', () => {
    expect(sortExerciseItems(ITEMS, 'status').map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const copy = [...ITEMS];
    sortExerciseItems(ITEMS, 'status');
    expect(ITEMS).toEqual(copy);
  });
});
