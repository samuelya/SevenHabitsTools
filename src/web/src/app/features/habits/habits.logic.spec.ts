import { laterLabel } from './habits.logic';

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
