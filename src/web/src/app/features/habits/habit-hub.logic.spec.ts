import { hubRowStatus } from './habit-hub.logic';

describe('hubRowStatus (#219)', () => {
  const status = { key: 'x.count', count: 2 };

  it('is done, with its date, whatever else is true', () => {
    expect(hubRowStatus(true, '2026-01-01T00:00:00.000Z', true, status)).toEqual({
      kind: 'done',
      completedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it("shows the exercise's own in-progress text when it has one", () => {
    expect(hubRowStatus(false, null, true, status)).toEqual({ kind: 'progress', status });
  });

  it('falls back to a generic "In progress" once started', () => {
    expect(hubRowStatus(false, null, true, null)).toEqual({ kind: 'started' });
  });

  it('is "Not started" for an entry with neither a started signal nor a status', () => {
    expect(hubRowStatus(false, null, false, null)).toEqual({ kind: 'notStarted' });
  });
});
