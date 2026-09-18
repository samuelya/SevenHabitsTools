import {
  DatedAssessment,
  latestAssessment,
  liveAssessments,
  parseIsoDate,
  previousAssessment,
  sortedByDateDesc,
} from './assessment-history.logic';

function assessment(overrides: Partial<DatedAssessment> = {}): DatedAssessment {
  return { id: 'a1', date: '2026-01-01', ...overrides };
}

describe('liveAssessments', () => {
  it('excludes tombstoned assessments', () => {
    const live = assessment({ id: 'a1' });
    const deleted = assessment({ id: 'a2', deletedAt: '2026-01-02T00:00:00.000Z' });
    expect(liveAssessments([live, deleted])).toEqual([live]);
  });
});

describe('sortedByDateDesc', () => {
  it('orders newest first', () => {
    const jan = assessment({ id: 'a1', date: '2026-01-01' });
    const mar = assessment({ id: 'a2', date: '2026-03-01' });
    const feb = assessment({ id: 'a3', date: '2026-02-01' });
    expect(sortedByDateDesc([jan, mar, feb]).map((a) => a.id)).toEqual(['a2', 'a3', 'a1']);
  });

  it('breaks a same-day tie by id for a stable order', () => {
    const first = assessment({ id: 'a1', date: '2026-01-01' });
    const second = assessment({ id: 'a2', date: '2026-01-01' });
    expect(sortedByDateDesc([first, second]).map((a) => a.id)).toEqual(['a2', 'a1']);
  });
});

describe('latestAssessment', () => {
  it('is null with no live assessments', () => {
    expect(latestAssessment([])).toBeNull();
    expect(latestAssessment([assessment({ deletedAt: '2026-01-02T00:00:00.000Z' })])).toBeNull();
  });

  it('is the most recent live assessment', () => {
    const jan = assessment({ id: 'a1', date: '2026-01-01' });
    const mar = assessment({ id: 'a2', date: '2026-03-01', deletedAt: '2026-03-02T00:00:00.000Z' });
    const feb = assessment({ id: 'a3', date: '2026-02-01' });
    expect(latestAssessment([jan, mar, feb])).toEqual(feb);
  });
});

describe('previousAssessment', () => {
  const jan = assessment({ id: 'a1', date: '2026-01-01' });
  const feb = assessment({ id: 'a2', date: '2026-02-01' });
  const mar = assessment({ id: 'a3', date: '2026-03-01' });

  it('is the assessment immediately before the given one in date order', () => {
    expect(previousAssessment([jan, feb, mar], 'a3')).toEqual(feb);
    expect(previousAssessment([jan, feb, mar], 'a2')).toEqual(jan);
  });

  it('is null for the earliest assessment', () => {
    expect(previousAssessment([jan, feb, mar], 'a1')).toBeNull();
  });

  it('is null for an id that is not live', () => {
    expect(previousAssessment([jan, feb, mar], 'missing')).toBeNull();
  });

  it('ignores a tombstoned assessment when finding the previous one', () => {
    const deletedFeb = { ...feb, deletedAt: '2026-02-02T00:00:00.000Z' };
    expect(previousAssessment([jan, deletedFeb, mar], 'a3')).toEqual(jan);
  });
});

describe('parseIsoDate', () => {
  it('reads a date-only string as local midnight, not UTC midnight', () => {
    const parsed = parseIsoDate('2026-06-15');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(15);
    expect(parsed.getHours()).toBe(0);
  });
});
