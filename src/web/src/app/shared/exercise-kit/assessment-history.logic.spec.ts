import {
  assessmentHistoryItems,
  DatedAssessment,
  isValidIsoDate,
  latestAssessment,
  liveAssessments,
  localDateString,
  parseIsoDate,
  previousAssessment,
  sortedByDateDesc,
} from './assessment-history.logic';

function assessment(overrides: Partial<DatedAssessment> = {}): DatedAssessment {
  return { id: 'a1', date: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
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

  it('breaks a same-day tie by createdAt, the one created last first', () => {
    // Ids deliberately sort the *opposite* way `createdAt` does, so a regression back to
    // tie-breaking on `id` (a random UUID, unrelated to creation order) would fail this.
    const earlier = assessment({
      id: 'z-earlier',
      date: '2026-01-01',
      createdAt: '2026-01-01T08:00:00.000Z',
    });
    const later = assessment({
      id: 'a-later',
      date: '2026-01-01',
      createdAt: '2026-01-01T20:00:00.000Z',
    });
    expect(sortedByDateDesc([earlier, later]).map((a) => a.id)).toEqual(['a-later', 'z-earlier']);
    expect(sortedByDateDesc([later, earlier]).map((a) => a.id)).toEqual(['a-later', 'z-earlier']);
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

  it('round-trips with localDateString', () => {
    const now = new Date(2026, 8, 3, 23, 45);
    expect(parseIsoDate(localDateString(now)).getDate()).toBe(now.getDate());
  });
});

describe('localDateString', () => {
  it('formats the local calendar date, zero-padded', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('uses the local date even a moment before local midnight, not the UTC one', () => {
    // 23:59 local time is still "today" locally, whatever UTC day that instant falls on.
    const lateLocal = new Date(2026, 5, 15, 23, 59, 0);
    expect(localDateString(lateLocal)).toBe('2026-06-15');
  });
});

describe('isValidIsoDate (issue #226)', () => {
  it('accepts a real calendar date', () => {
    expect(isValidIsoDate('2026-09-25')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
  });

  it('rejects a cleared, partial or malformed value', () => {
    for (const value of ['', '2026-9-25', '2026-09', '25/09/2026', '2026-09-25T00:00']) {
      expect(isValidIsoDate(value)).toBe(false);
    }
  });

  it('rejects an impossible date, including one that would roll over (#224)', () => {
    for (const value of ['2026-02-30', '2026-13-01', '2026-00-10', '2027-02-29', '2026-04-31']) {
      expect(isValidIsoDate(value)).toBe(false);
    }
  });
});

describe('assessmentHistoryItems (issue #226)', () => {
  it('maps the given history to rows in its order, each with its summary', () => {
    const items = assessmentHistoryItems(
      [
        assessment({ id: 'new', date: '2026-03-01' }),
        assessment({ id: 'old', date: '2026-01-01' }),
      ],
      (entry) => ({ key: `summary.${entry.id}`, count: 2 }),
    );
    expect(items).toEqual([
      { id: 'new', date: '2026-03-01', summary: { key: 'summary.new', count: 2 } },
      { id: 'old', date: '2026-01-01', summary: { key: 'summary.old', count: 2 } },
    ]);
  });

  it('leaves the summary out while an assessment has no result', () => {
    expect(assessmentHistoryItems([assessment()], () => null)).toEqual([
      { id: 'a1', date: '2026-01-01' },
    ]);
  });
});
