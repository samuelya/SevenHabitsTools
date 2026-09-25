import {
  canMakePromise,
  checklistLabelsFrom,
  checklistLoaded,
  concernFromExample,
  controlChange,
  doneChecklist,
  editConcern,
  groupConcerns,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isItemComplete,
  isStarted,
  labelsFrom,
  liveSampleOf,
  removeConcern,
  restoreConcern,
  statusesFor,
  summarize,
  toListItem,
} from './circle.logic';
import { Concern } from './circle.model';

const NOW = new Date('2026-02-01T10:00:00.000Z');

function concern(overrides: Partial<Concern> = {}): Concern {
  return {
    id: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'The deadline keeps moving',
    control: 'direct',
    status: 'open',
    ...overrides,
  };
}

const LABELS = labelsFrom(
  ['Up to me', 'Up to others too', "Out of anyone's hands"],
  ['Open', 'Step taken', 'Sorted', 'Let go'],
  'Example',
);
const CHECKLIST = checklistLabelsFrom(['Add', 'Say', 'Write', 'Take']);

describe('isItemComplete', () => {
  it('branch A needs a first step and Step taken or Sorted', () => {
    expect(isItemComplete(concern({ firstStep: 'Ask', status: 'stepTaken' }))).toBe(true);
    expect(
      isItemComplete(concern({ control: 'indirect', firstStep: 'Ask', status: 'sorted' })),
    ).toBe(true);
    expect(isItemComplete(concern({ firstStep: 'Ask', status: 'open' }))).toBe(false);
    expect(isItemComplete(concern({ firstStep: '  ', status: 'stepTaken' }))).toBe(false);
    expect(isItemComplete(concern({ letGoNote: 'Fine', status: 'letGo' }))).toBe(false);
  });

  it('branch B needs a letting-go line and Let go', () => {
    expect(isItemComplete(concern({ control: 'none', letGoNote: 'Read', status: 'letGo' }))).toBe(
      true,
    );
    expect(isItemComplete(concern({ control: 'none', letGoNote: 'Read', status: 'open' }))).toBe(
      false,
    );
    expect(isItemComplete(concern({ control: 'none', firstStep: 'Ask', status: 'letGo' }))).toBe(
      false,
    );
  });

  it('needs the concern itself', () => {
    expect(isItemComplete(concern({ title: ' ', firstStep: 'Ask', status: 'stepTaken' }))).toBe(
      false,
    );
  });
});

describe('statusesFor and controlChange', () => {
  it('offers each branch its own statuses', () => {
    expect(statusesFor('direct')).toEqual(['open', 'stepTaken', 'sorted']);
    expect(statusesFor('indirect')).toEqual(['open', 'stepTaken', 'sorted']);
    expect(statusesFor('none')).toEqual(['open', 'letGo']);
  });

  it('keeps a status valid in the new branch and resets one that is not', () => {
    expect(controlChange({ status: 'stepTaken' }, 'indirect')).toEqual({ control: 'indirect' });
    expect(controlChange({ status: 'open' }, 'none')).toEqual({ control: 'none' });
    expect(controlChange({ status: 'stepTaken' }, 'none')).toEqual({
      control: 'none',
      status: 'open',
    });
    expect(controlChange({ status: 'letGo' }, 'direct')).toEqual({
      control: 'direct',
      status: 'open',
    });
  });
});

describe('isStarted, hubStatus and summarize', () => {
  const concerns = [
    concern({ id: 'a', firstStep: 'Ask' }),
    concern({ id: 'b', control: 'indirect' }),
    concern({ id: 'c', control: 'none', letGoNote: 'Read' }),
    concern({ id: 'd', firstStep: 'Gone', deletedAt: '2026-01-02T00:00:00.000Z' }),
    concern({ id: 'e', firstStep: 'Sample', sample: true }),
  ];

  it('counts live non-sample concerns only', () => {
    expect(isStarted([])).toBe(false);
    expect(isStarted([concern({ sample: true })])).toBe(false);
    expect(isStarted(concerns)).toBe(true);
    expect(hubStatus([])).toBeNull();
    expect(hubStatus(concerns)).toEqual({
      key: 'habits.exercises.h1-circle.concernCount',
      count: 3,
    });
  });

  it('summarises first steps over the branch A concerns', () => {
    expect(summarize(concerns)).toEqual({ withStep: 1, total: 2 });
    expect(summarize([concern({ control: 'none' })])).toEqual({ withStep: 0, total: 0 });
  });
});

describe('done checklist', () => {
  it('reports the closest counted concern and gates Mark done', () => {
    const concerns = [
      concern({ id: 'a' }),
      concern({ id: 'b', control: 'none', letGoNote: 'Read' }),
    ];
    expect(doneChecklist(concerns, CHECKLIST)).toEqual([
      { label: 'Add', met: true },
      { label: 'Say', met: true },
      { label: 'Write', met: true },
      { label: 'Take', met: false },
    ]);
    expect(isComplete(concerns)).toBe(false);
    expect(
      isComplete([...concerns, concern({ id: 'c', firstStep: 'Ask', status: 'sorted' })]),
    ).toBe(true);
  });

  it('ignores samples and deleted concerns', () => {
    const complete = { firstStep: 'Ask', status: 'stepTaken' as const };
    expect(isComplete([concern({ ...complete, sample: true })])).toBe(false);
    expect(isComplete([concern({ ...complete, deletedAt: '2026-01-02T00:00:00.000Z' })])).toBe(
      false,
    );
    expect(doneChecklist([], CHECKLIST).every((item) => !item.met)).toBe(true);
  });

  it('waits for the labels to load', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(CHECKLIST)).toBe(true);
  });
});

describe('toListItem and groupConcerns', () => {
  it('shows the concern, the control and the status', () => {
    expect(toListItem(concern({ firstStep: 'Ask', status: 'stepTaken' }), LABELS)).toEqual({
      id: 'c1',
      title: 'The deadline keeps moving',
      subtitle: 'Up to me · Step taken',
      done: true,
    });
  });

  it('falls back to other text, marks a sample and never renders "undefined" before load', () => {
    const item = toListItem(concern({ title: '', have: 'More time', sample: true }), LABELS);
    expect(item.title).toBe('More time');
    expect(item.chips).toEqual([{ label: 'Example' }]);
    expect(item.done).toBe(false);
    const cold = toListItem(concern({ status: 'letGo', control: 'none' }), labelsFrom([''], ['']));
    expect(cold.subtitle).toBe('');
  });

  it('groups things you can affect before things you cannot control', () => {
    const groups = groupConcerns([
      concern({ id: 'a', control: 'none' }),
      concern({ id: 'b', control: 'indirect' }),
      concern({ id: 'c' }),
    ]);
    expect(groups.affect.map((c) => c.id)).toEqual(['b', 'c']);
    expect(groups.cannotControl.map((c) => c.id)).toEqual(['a']);
  });
});

describe('isDraftWorthSaving', () => {
  it('saves on typed text in any free-text field only', () => {
    expect(isDraftWorthSaving({ title: '' })).toBe(false);
    expect(isDraftWorthSaving({ title: '  ', firstStep: '' })).toBe(false);
    for (const field of ['title', 'have', 'be', 'firstStep', 'letGoNote'] as const) {
      expect(isDraftWorthSaving({ title: '', [field]: 'x' })).toBe(true);
    }
  });
});

describe('editConcern, removeConcern and restoreConcern', () => {
  it('edits the live concern, keeps the other branch text and drops the sample flag', () => {
    const [edited] = editConcern([concern({ firstStep: 'Ask', sample: true })], 'c1', {
      control: 'none',
    });
    expect(edited.control).toBe('none');
    expect(edited.firstStep).toBe('Ask');
    expect('sample' in edited).toBe(false);
  });

  it('clears a due date set to an empty string', () => {
    const [edited] = editConcern([concern({ dueDate: '2026-02-03' })], 'c1', { dueDate: '' });
    expect('dueDate' in edited).toBe(false);
  });

  it('leaves a tombstoned or other concern alone', () => {
    const gone = concern({ deletedAt: '2026-01-02T00:00:00.000Z' });
    expect(editConcern([gone], 'c1', { title: 'x' })[0]).toBe(gone);
    expect(editConcern([concern()], 'other', { title: 'x' })[0].title).toBe(
      'The deadline keeps moving',
    );
  });

  it('tombstones and restores', () => {
    const [removed] = removeConcern([concern()], 'c1', NOW);
    expect(removed.deletedAt).toBe(NOW.toISOString());
    const [restored] = restoreConcern([removed], 'c1', NOW);
    expect(restored.deletedAt).toBeUndefined();
  });
});

describe('canMakePromise', () => {
  it('needs branch A, a first step and no live promise', () => {
    expect(canMakePromise({ control: 'direct', firstStep: 'Ask' }, false)).toBe(true);
    expect(canMakePromise({ control: 'indirect', firstStep: 'Ask' }, true)).toBe(false);
    expect(canMakePromise({ control: 'direct', firstStep: ' ' }, false)).toBe(false);
    expect(canMakePromise({ control: 'none', firstStep: 'Ask' }, false)).toBe(false);
  });
});

describe('concernFromExample and liveSampleOf', () => {
  it('builds an open concern with a due date a week out when it has a first step', () => {
    expect(
      concernFromExample(
        { title: 'Deadline', control: 'indirect', have: 'a plan', firstStep: 'Ask' },
        '2026-02-26',
      ),
    ).toEqual({
      title: 'Deadline',
      control: 'indirect',
      status: 'open',
      have: 'a plan',
      firstStep: 'Ask',
      dueDate: '2026-03-05',
    });
    expect(
      concernFromExample({ title: 'Bus', control: 'none', letGoNote: 'Read' }, '2026-02-26'),
    ).toEqual({ title: 'Bus', control: 'none', status: 'open', letGoNote: 'Read' });
  });

  it('rejects an invalid payload', () => {
    expect(concernFromExample(null, '2026-02-26')).toBeNull();
    expect(concernFromExample({ title: '', control: 'none' }, '2026-02-26')).toBeNull();
    expect(concernFromExample({ title: 'x', control: 'some' }, '2026-02-26')).toBeNull();
  });

  it('finds a still-flagged sample of the same example, whatever its due date', () => {
    const fields = concernFromExample(
      { title: 'D', control: 'direct', firstStep: 'Ask' },
      '2026-02-26',
    )!;
    const sample = concern({ ...fields, dueDate: '2026-01-01', sample: true });
    expect(liveSampleOf([sample], fields)).toBe(sample);
    expect(liveSampleOf([{ ...sample, sample: undefined }], fields)).toBeUndefined();
  });
});
