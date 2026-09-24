import { isCounted, withoutSample } from './sample-record.logic';

const BASE = {
  id: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('sample-record.logic', () => {
  it('counts a live record, but neither a sample nor a tombstone', () => {
    expect(isCounted(BASE)).toBe(true);
    expect(isCounted({ ...BASE, sample: false })).toBe(true);
    expect(isCounted({ ...BASE, sample: true })).toBe(false);
    expect(isCounted({ ...BASE, deletedAt: '2026-01-02T00:00:00.000Z' })).toBe(false);
  });

  it('removes the sample flag, keeping every other field', () => {
    const record = { ...BASE, text: 'x', sample: true };

    const own = withoutSample(record);

    expect(own).toEqual({ ...BASE, text: 'x' });
    expect('sample' in own).toBe(false);
  });

  it('returns the same record when there is no flag to remove', () => {
    const record = { ...BASE, text: 'x' };
    expect(withoutSample(record)).toBe(record);
  });
});
