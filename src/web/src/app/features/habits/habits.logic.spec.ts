import { progressPercentage } from './habits.logic';

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
