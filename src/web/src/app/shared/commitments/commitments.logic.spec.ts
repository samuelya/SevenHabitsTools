import {
  addDays,
  countsByStatus,
  editCommitment,
  forSource,
  integrityRate,
  isDueOn,
  isOverdue,
  removeCommitment,
  reopenCommitment,
  resolveCommitment,
  resolvedBetween,
  restoreCommitment,
  tidyCommitment,
} from './commitments.logic';
import { Commitment } from './commitments.model';

const NOW = new Date('2026-03-10T09:00:00');
const TODAY = '2026-03-10';

function promise(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: overrides.id ?? 'c1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    text: 'Call Mum.',
    toWhom: 'self',
    status: 'open',
    ...overrides,
  };
}

describe('addDays', () => {
  it('moves across month and year ends, both ways', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('integrityRate', () => {
  const list = [
    promise({ id: 'a', status: 'kept', resolvedOn: '2026-03-09' }),
    promise({ id: 'b', status: 'kept', resolvedOn: '2026-01-01' }),
    promise({ id: 'c', status: 'broken', resolvedOn: '2026-02-09' }),
    promise({ id: 'd', status: 'withdrawn', resolvedOn: '2026-03-09' }),
    promise({ id: 'e', status: 'open' }),
    promise({ id: 'f', status: 'kept', resolvedOn: '2026-03-09', sample: true }),
    promise({ id: 'g', status: 'broken', resolvedOn: '2026-03-09', deletedAt: '2026-03-09' }),
  ];

  it('counts kept and broken, not open, withdrawn, samples or deleted', () => {
    expect(integrityRate(list, { today: TODAY })).toEqual({ kept: 2, broken: 1, rate: 67 });
  });

  it('limits to the last windowDays by resolvedOn, today included', () => {
    // 30 days up to 2026-03-10 starts on 2026-02-09.
    expect(integrityRate(list, { today: TODAY, windowDays: 30 })).toEqual({
      kept: 1,
      broken: 1,
      rate: 50,
    });
    expect(integrityRate(list, { today: TODAY, windowDays: 29 })).toEqual({
      kept: 1,
      broken: 0,
      rate: 100,
    });
  });

  it('has a null rate with nothing resolved', () => {
    expect(integrityRate([promise()], { today: TODAY })).toEqual({
      kept: 0,
      broken: 0,
      rate: null,
    });
    expect(integrityRate([], { today: TODAY })).toEqual({ kept: 0, broken: 0, rate: null });
  });

  it('rounds to a whole percent', () => {
    const rated = [
      promise({ id: '1', status: 'kept', resolvedOn: TODAY }),
      promise({ id: '2', status: 'broken', resolvedOn: TODAY }),
      promise({ id: '3', status: 'broken', resolvedOn: TODAY }),
    ];
    expect(integrityRate(rated, { today: TODAY }).rate).toBe(33);
  });
});

describe('isOverdue / isDueOn', () => {
  it('is overdue only while open with a due date before today', () => {
    expect(isOverdue(promise({ dueDate: '2026-03-09' }), TODAY)).toBe(true);
    expect(isOverdue(promise({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(promise(), TODAY)).toBe(false);
    expect(isOverdue(promise({ dueDate: '' }), TODAY)).toBe(false);
    expect(isOverdue(promise({ dueDate: '2026-03-01', status: 'kept' }), TODAY)).toBe(false);
  });

  it('is due on its due date, whatever its status', () => {
    expect(isDueOn(promise({ dueDate: TODAY, status: 'kept' }), TODAY)).toBe(true);
    expect(isDueOn(promise(), TODAY)).toBe(false);
  });
});

describe('countsByStatus / forSource / resolvedBetween', () => {
  const list = [
    promise({
      id: 'a',
      status: 'kept',
      resolvedOn: '2026-03-02',
      source: { exerciseId: 'h1-circle', recordId: 'r1' },
    }),
    promise({ id: 'b', source: { exerciseId: 'h1-circle', recordId: 'r2' } }),
    promise({ id: 'c', status: 'broken', resolvedOn: '2026-03-05' }),
    promise({ id: 'd', sample: true }),
    promise({ id: 'e', deletedAt: '2026-03-01', source: { exerciseId: 'h1-circle' } }),
  ];

  it('counts counted promises per status', () => {
    expect(countsByStatus(list)).toEqual({ open: 1, kept: 1, broken: 1, withdrawn: 0 });
  });

  it('finds the live promises a source made, optionally for one record', () => {
    expect(forSource(list, 'h1-circle').map((c) => c.id)).toEqual(['a', 'b']);
    expect(forSource(list, 'h1-circle', 'r2').map((c) => c.id)).toEqual(['b']);
    expect(forSource(list, 'h1-rehearsal')).toEqual([]);
  });

  it('finds promises resolved in an inclusive range', () => {
    expect(resolvedBetween(list, '2026-03-02', '2026-03-05').map((c) => c.id)).toEqual(['a', 'c']);
    expect(resolvedBetween(list, '2026-03-03', '2026-03-04')).toEqual([]);
  });
});

describe('edits', () => {
  it('edits the promise fields only while open, and clears an emptied due date or name', () => {
    const [edited] = editCommitment(
      [promise({ dueDate: TODAY, personName: 'Dina', toWhom: 'other' })],
      'c1',
      { text: 'Call Dad.', dueDate: '', personName: '' },
      NOW,
    );
    expect(edited.text).toBe('Call Dad.');
    expect('dueDate' in edited).toBe(false);
    expect('personName' in edited).toBe(false);
    expect(edited.updatedAt).toBe(NOW.toISOString());

    const kept = promise({ status: 'kept', resolvedOn: TODAY });
    expect(editCommitment([kept], 'c1', { text: 'Changed' }, NOW)).toEqual([kept]);
  });

  it('edits the repair note only while broken', () => {
    const broken = promise({ status: 'broken', resolvedOn: TODAY });
    expect(editCommitment([broken], 'c1', { repairNote: 'Too big.' }, NOW)[0].repairNote).toBe(
      'Too big.',
    );
    expect(
      editCommitment([promise()], 'c1', { repairNote: 'x' }, NOW)[0].repairNote,
    ).toBeUndefined();
  });

  it('makes a sample the user own on any edit (#232)', () => {
    const [edited] = editCommitment([promise({ sample: true })], 'c1', { text: 'Mine' }, NOW);
    expect('sample' in edited).toBe(false);
    const [resolved] = resolveCommitment([promise({ sample: true })], 'c1', 'kept', TODAY, NOW);
    expect('sample' in resolved).toBe(false);
  });

  it('resolves with today as resolvedOn, and keeps a repair note only for broken', () => {
    const [kept] = resolveCommitment([promise()], 'c1', 'kept', TODAY, NOW, 'ignored');
    expect(kept).toMatchObject({ status: 'kept', resolvedOn: TODAY });
    expect(kept.repairNote).toBeUndefined();
    const [broken] = resolveCommitment([promise()], 'c1', 'broken', TODAY, NOW, 'Too big.');
    expect(broken).toMatchObject({ status: 'broken', resolvedOn: TODAY, repairNote: 'Too big.' });
  });

  it('reopens: status open, resolvedOn cleared', () => {
    const [reopened] = reopenCommitment(
      [promise({ status: 'withdrawn', resolvedOn: TODAY })],
      'c1',
      NOW,
    );
    expect(reopened.status).toBe('open');
    expect('resolvedOn' in reopened).toBe(false);
  });

  // Review finding 3 (PR #282).
  it('drops the repair note when resolving Kept or Withdrawn, and on Reopen', () => {
    const [kept] = resolveCommitment(
      [promise({ repairNote: 'Old note.' })],
      'c1',
      'kept',
      TODAY,
      NOW,
    );
    expect('repairNote' in kept).toBe(false);
    const [withdrawn] = resolveCommitment(
      [promise({ repairNote: 'Old note.' })],
      'c1',
      'withdrawn',
      TODAY,
      NOW,
    );
    expect('repairNote' in withdrawn).toBe(false);
    const [reopened] = reopenCommitment(
      [promise({ status: 'broken', resolvedOn: TODAY, repairNote: 'Too big.' })],
      'c1',
      NOW,
    );
    expect('repairNote' in reopened).toBe(false);
  });

  it('leaves a promise that is not open alone on resolve, so resolvedOn never moves', () => {
    const kept = promise({ status: 'kept', resolvedOn: '2026-03-01' });
    expect(resolveCommitment([kept], 'c1', 'broken', TODAY, NOW)).toEqual([kept]);
    expect(resolveCommitment([kept], 'c1', 'kept', TODAY, NOW)).toEqual([kept]);
  });

  // Review finding 4 (PR #282).
  it('removes the person name when the promise becomes one to oneself', () => {
    const [edited] = editCommitment(
      [promise({ toWhom: 'other', personName: 'Dina' })],
      'c1',
      { toWhom: 'self' },
      NOW,
    );
    expect(edited.toWhom).toBe('self');
    expect('personName' in edited).toBe(false);
  });

  it('never touches a deleted or another promise', () => {
    const deleted = promise({ deletedAt: '2026-03-02T00:00:00.000Z' });
    const other = promise({ id: 'c2' });
    expect(resolveCommitment([deleted, other], 'c1', 'kept', TODAY, NOW)).toEqual([deleted, other]);
  });

  it('soft-deletes and restores', () => {
    const [removed] = removeCommitment([promise()], 'c1', NOW);
    expect(removed.deletedAt).toBe(NOW.toISOString());
    const [restored] = restoreCommitment([removed], 'c1', NOW);
    expect('deletedAt' in restored).toBe(false);
  });
});

// Review finding 8 (PR #282): the one normaliser every write goes through.
describe('tidyCommitment', () => {
  it('removes undefined keys and cleared optional text, keeping an empty promise text', () => {
    const tidy = tidyCommitment({
      ...promise({ text: '', toWhom: 'other' }),
      dueDate: '',
      personName: '',
      repairNote: '',
      resolvedOn: undefined,
      sample: undefined,
    });
    expect(tidy).toEqual(promise({ text: '', toWhom: 'other' }));
    expect(Object.values(tidy)).not.toContain(undefined);
  });

  it('drops a person name on a promise to oneself and keeps it for someone else', () => {
    expect('personName' in tidyCommitment(promise({ personName: 'Dina' }))).toBe(false);
    expect(tidyCommitment(promise({ toWhom: 'other', personName: 'Dina' })).personName).toBe(
      'Dina',
    );
  });
});
