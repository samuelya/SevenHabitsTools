import { Commitment } from '../../shared/commitments/commitments.model';
import {
  checklistLabelsFrom,
  checklistLoaded,
  commitmentFromExample,
  CommitmentLabels,
  doneChecklist,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  listOrder,
  liveSampleOf,
  matchesFilter,
  SOURCE_TOKEN,
  sourceIds,
  sourceLine,
  statusLabelsFrom,
  summarize,
  toListItem,
} from './commitments.logic';

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

const LABELS: CommitmentLabels = {
  status: { open: 'Open', kept: 'Kept', broken: 'Broken', withdrawn: 'Withdrawn' },
  example: 'Example',
  overdue: 'Overdue',
  sourceTemplate: `From: ${SOURCE_TOKEN}`,
  sourceTitles: { 'h1-circle': 'Your influence' },
  formatDate: (date) => `<${date}>`,
};

describe('isStarted / hubStatus', () => {
  it('ignores samples and deleted promises', () => {
    expect(isStarted([promise({ sample: true }), promise({ deletedAt: 'x' })])).toBe(false);
    expect(isStarted([promise()])).toBe(true);
    expect(hubStatus([promise({ sample: true })])).toBeNull();
  });

  it('says "3 open" while nothing is resolved, then "4 of 5 kept"', () => {
    const open = [promise({ id: 'a' }), promise({ id: 'b' }), promise({ id: 'c' })];
    expect(hubStatus(open)).toEqual({ key: 'habits.exercises.h1-commitments.openCount', count: 3 });
    const resolved = [
      ...open,
      promise({ id: 'k', status: 'kept' }),
      promise({ id: 'x', status: 'broken' }),
      promise({ id: 'w', status: 'withdrawn' }),
    ];
    expect(hubStatus(resolved)).toEqual({
      key: 'habits.exercises.h1-commitments.keptOf',
      count: 2,
      params: { kept: 1 },
    });
    expect(hubStatus([promise({ status: 'withdrawn' })])).toBeNull();
  });
});

describe('done gate', () => {
  const labels = checklistLabelsFrom(['Write', 'Date', 'Keep']);

  it('is enabled by one counted Kept promise only', () => {
    expect(isComplete([])).toBe(false);
    expect(isComplete([promise({ status: 'kept', sample: true })])).toBe(false);
    expect(isComplete([promise({ status: 'broken' })])).toBe(false);
    expect(isComplete([promise({ status: 'kept' })])).toBe(true);
  });

  it('describes the promise closest to done, all unmet with none', () => {
    expect(doneChecklist([], labels).map((item) => item.met)).toEqual([false, false, false]);
    expect(
      doneChecklist([promise({ id: 'a' }), promise({ id: 'b', dueDate: TODAY })], labels).map(
        (item) => item.met,
      ),
    ).toEqual([true, true, false]);
  });

  it('always has an unmet row while the gate is closed', () => {
    const list = [promise({ dueDate: TODAY, status: 'broken' })];
    expect(isComplete(list)).toBe(false);
    expect(doneChecklist(list, labels).some((item) => !item.met)).toBe(true);
  });

  it('waits for the labels to load', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(labels)).toBe(true);
  });
});

describe('filters', () => {
  it('matches each status filter on today', () => {
    const overdue = promise({ dueDate: '2026-03-09' });
    const dueToday = promise({ dueDate: TODAY });
    const kept = promise({ status: 'kept', dueDate: TODAY });
    expect(matchesFilter(kept, 'all', null, TODAY)).toBe(true);
    expect(matchesFilter(overdue, 'open', null, TODAY)).toBe(true);
    expect(matchesFilter(kept, 'open', null, TODAY)).toBe(false);
    expect(matchesFilter(dueToday, 'dueToday', null, TODAY)).toBe(true);
    expect(matchesFilter(kept, 'dueToday', null, TODAY)).toBe(false);
    expect(matchesFilter(overdue, 'overdue', null, TODAY)).toBe(true);
    expect(matchesFilter(dueToday, 'overdue', null, TODAY)).toBe(false);
    expect(matchesFilter(kept, 'kept', null, TODAY)).toBe(true);
    expect(matchesFilter(kept, 'broken', null, TODAY)).toBe(false);
  });

  it('filters by source and lists the sources present', () => {
    const fromCircle = promise({ id: 'a', source: { exerciseId: 'h1-circle' } });
    expect(matchesFilter(fromCircle, 'all', 'h1-circle', TODAY)).toBe(true);
    expect(matchesFilter(promise(), 'all', 'h1-circle', TODAY)).toBe(false);
    expect(
      sourceIds([
        fromCircle,
        promise({ id: 'b', source: { exerciseId: 'h1-circle' } }),
        promise({ id: 'c', source: { exerciseId: 'h1-rehearsal' } }),
        promise({ id: 'd', source: { exerciseId: 'gone' }, deletedAt: 'x' }),
      ]),
    ).toEqual(['h1-circle', 'h1-rehearsal']);
    expect(sourceIds([promise()])).toEqual([]);
  });

  it('orders open by due date (undated last), then resolved latest first', () => {
    const ordered = listOrder([
      promise({ id: 'kept-old', status: 'kept', resolvedOn: '2026-03-01' }),
      promise({ id: 'undated' }),
      promise({ id: 'later', dueDate: '2026-03-20' }),
      promise({ id: 'kept-new', status: 'kept', resolvedOn: '2026-03-08' }),
      promise({ id: 'sooner', dueDate: '2026-03-11' }),
    ]);
    expect(ordered.map((c) => c.id)).toEqual([
      'sooner',
      'later',
      'undated',
      'kept-new',
      'kept-old',
    ]);
  });
});

describe('summarize', () => {
  it('is null until something is kept or broken, so no zero is shown', () => {
    expect(summarize([promise(), promise({ id: 'w', status: 'withdrawn' })], TODAY)).toBeNull();
  });

  it('drops the 30-day line when nothing was resolved in that window', () => {
    const old = [promise({ status: 'kept', resolvedOn: '2025-12-01' })];
    expect(summarize(old, TODAY)).toEqual({
      allTime: { kept: 1, broken: 0, rate: 100 },
      last30: null,
    });
  });
});

describe('toListItem', () => {
  it('shows the promise, its due date and status, and its source as a chip', () => {
    const item = toListItem(
      promise({ dueDate: '2026-03-12', source: { exerciseId: 'h1-circle' } }),
      LABELS,
      TODAY,
    );
    expect(item).toEqual({
      id: 'c1',
      title: 'Call Mum.',
      subtitle: '<2026-03-12> · Open',
      chips: [{ label: 'From: Your influence' }],
      done: false,
    });
  });

  it('marks an overdue row as a warning with a hidden label, and a kept one done', () => {
    const overdue = toListItem(promise({ dueDate: '2026-03-01' }), LABELS, TODAY);
    expect(overdue).toMatchObject({ warning: true, warningLabel: 'Overdue' });
    expect(toListItem(promise({ status: 'kept' }), LABELS, TODAY).done).toBe(true);
  });

  it('never shows a sample as overdue or done, and labels it Example', () => {
    const item = toListItem(
      promise({ sample: true, status: 'kept', dueDate: '2026-03-01' }),
      LABELS,
      TODAY,
    );
    expect(item.chips).toEqual([{ label: 'Example' }]);
    expect(item.done).toBe(false);
    expect(item.warning).toBeUndefined();
  });

  it('leaves out an unknown source and falls back to blank labels before load', () => {
    const item = toListItem(promise({ source: { exerciseId: 'h9-future' } }), LABELS, TODAY);
    expect(item.chips).toBeUndefined();
    expect(statusLabelsFrom([''])).toEqual({ open: '', kept: '', broken: '', withdrawn: '' });
    expect(sourceLine(`From: ${SOURCE_TOKEN}`, 'Your influence')).toBe('From: Your influence');
  });

  // Transloco re-scans an interpolated value for `{{…}}`, so a braced token never terminates
  // (the CI hang at f0ab823).
  it('uses a source token Transloco does not interpolate again', () => {
    expect(SOURCE_TOKEN).not.toMatch(/\{\{|\}\}/);
  });
});

describe('draft and samples', () => {
  it('saves a draft on its first typed text only', () => {
    expect(isDraftWorthSaving({ text: '  ' })).toBe(false);
    expect(isDraftWorthSaving({ text: 'C' })).toBe(true);
  });

  it('builds a sample due three days from today, open, never a stored date (#275)', () => {
    expect(commitmentFromExample({ text: 'Call Mum.', toWhom: 'self' }, TODAY)).toEqual({
      text: 'Call Mum.',
      toWhom: 'self',
      dueDate: '2026-03-13',
      status: 'open',
    });
    expect(
      commitmentFromExample(
        { text: 'Send it.', toWhom: 'other', personName: 'Dina' },
        '2026-12-30',
      ),
    ).toEqual({
      text: 'Send it.',
      toWhom: 'other',
      personName: 'Dina',
      dueDate: '2027-01-02',
      status: 'open',
    });
  });

  it('refuses an invalid example payload', () => {
    expect(commitmentFromExample(null, TODAY)).toBeNull();
    expect(commitmentFromExample({ text: '', toWhom: 'self' }, TODAY)).toBeNull();
    expect(commitmentFromExample({ text: 'x', toWhom: 'boss' }, TODAY)).toBeNull();
  });

  it('finds an untouched sample already tried', () => {
    const sample = promise({ sample: true });
    expect(liveSampleOf([sample], { text: 'Call Mum.' })).toBe(sample);
    expect(liveSampleOf([promise()], { text: 'Call Mum.' })).toBeUndefined();
  });
});
