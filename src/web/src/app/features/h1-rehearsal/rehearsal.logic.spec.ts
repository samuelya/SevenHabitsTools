import type { Commitment } from '../../shared/commitments/commitments.model';
import {
  byDate,
  checklistLabelsFrom,
  checklistLoaded,
  defaultKept,
  doneChecklist,
  editRehearsal,
  followUpOpen,
  followUpOutcome,
  followUpValid,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isItemComplete,
  isStarted,
  liveSampleOf,
  promiseSync,
  rehearsalEdit,
  rehearsalFromExample,
  removeRehearsal,
  restoreRehearsal,
  rowStatus,
  sceneWritten,
  statusLabelsFrom,
  successRatio,
  tidyFollowUp,
  toListItem,
  type RehearsalLabels,
} from './rehearsal.logic';
import { Rehearsal } from './rehearsal.model';

const NOW = new Date('2026-02-01T10:00:00.000Z');
const TODAY = '2026-02-10';
const SCENE = 'I take a breath and say: "Ask me one question and I will answer it properly."';

function rehearsal(overrides: Partial<Rehearsal> = {}): Rehearsal {
  return {
    id: 'r1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    trigger: 'Sunday lunch',
    ...overrides,
  };
}

function complete(overrides: Partial<Rehearsal> = {}): Rehearsal {
  return rehearsal({
    expectedOn: '2026-02-15',
    usualReaction: 'I get short with him.',
    cost: 'The afternoon is ruined.',
    chosenResponse: SCENE,
    promise: 'Answer calmly.',
    ...overrides,
  });
}

function commitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    text: 'Answer calmly.',
    toWhom: 'self',
    dueDate: '2026-02-15',
    status: 'open',
    ...overrides,
  };
}

const LABELS: RehearsalLabels = {
  status: statusLabelsFrom(['Planned', 'Ready to follow up', 'Followed up']),
  example: 'Example',
  formatDate: (date) => `<${date}>`,
};
const CHECKLIST = checklistLabelsFrom(['Name', 'Write usual', 'Write scene', 'Promise']);

describe('sceneWritten', () => {
  it('counts a scene from 60 trimmed characters', () => {
    expect(sceneWritten('x'.repeat(60))).toBe(true);
    expect(sceneWritten(`  ${'x'.repeat(59)}  `)).toBe(false);
    expect(sceneWritten(undefined)).toBe(false);
  });
});

describe('isItemComplete', () => {
  it('needs every part, a real date and a scene of 60 characters', () => {
    expect(isItemComplete(complete())).toBe(true);
    expect(isItemComplete(complete({ trigger: '  ' }))).toBe(false);
    expect(isItemComplete(complete({ expectedOn: undefined }))).toBe(false);
    expect(isItemComplete(complete({ expectedOn: '2026-13-01' }))).toBe(false);
    expect(isItemComplete(complete({ usualReaction: '' }))).toBe(false);
    expect(isItemComplete(complete({ cost: undefined }))).toBe(false);
    expect(isItemComplete(complete({ chosenResponse: 'Too short.' }))).toBe(false);
    expect(isItemComplete(complete({ promise: ' ' }))).toBe(false);
  });

  it('does not need the follow-up', () => {
    expect(isItemComplete(complete({ followUp: undefined }))).toBe(true);
  });
});

describe('isStarted, hubStatus and isComplete', () => {
  it('count only live, non-sample rehearsals', () => {
    const deleted = complete({ id: 'd', deletedAt: NOW.toISOString() });
    const sample = complete({ id: 's', sample: true });
    expect(isStarted([deleted, sample])).toBe(false);
    expect(hubStatus([deleted, sample])).toBeNull();
    expect(isComplete([deleted, sample])).toBe(false);

    expect(isStarted([rehearsal()])).toBe(true);
    expect(hubStatus([rehearsal(), rehearsal({ id: 'r2' }), deleted])).toEqual({
      key: 'habits.exercises.h1-rehearsal.rehearsalCount',
      count: 2,
    });
    expect(isComplete([rehearsal(), complete({ id: 'r2' })])).toBe(true);
  });
});

describe('doneChecklist', () => {
  it('describes the rehearsal closest to complete', () => {
    const items = doneChecklist(
      [rehearsal(), complete({ id: 'r2', chosenResponse: 'Short' })],
      CHECKLIST,
    );
    expect(items.map((item) => item.met)).toEqual([true, true, false, true]);
  });

  it('with nothing yet, nothing is met', () => {
    expect(doneChecklist([], CHECKLIST).map((item) => item.met)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('the promise item needs the date too', () => {
    const items = doneChecklist([complete({ expectedOn: undefined })], CHECKLIST);
    expect(items[3].met).toBe(false);
  });

  it('waits for real labels before it renders', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(CHECKLIST)).toBe(true);
  });
});

describe('rowStatus and followUpOpen', () => {
  it('is planned for a future or missing date, due from the date, followed up once it happened', () => {
    expect(rowStatus(rehearsal({ expectedOn: '2026-02-11' }), TODAY)).toBe('planned');
    expect(rowStatus(rehearsal(), TODAY)).toBe('planned');
    expect(rowStatus(rehearsal({ expectedOn: TODAY }), TODAY)).toBe('due');
    expect(rowStatus(rehearsal({ expectedOn: '2026-02-01' }), TODAY)).toBe('due');
    expect(
      rowStatus(rehearsal({ expectedOn: '2026-02-01', followUp: { happened: false } }), TODAY),
    ).toBe('due');
    expect(
      rowStatus(rehearsal({ expectedOn: '2026-02-01', followUp: { happened: true } }), TODAY),
    ).toBe('followedUp');
  });

  it('opens Afterwards on the date and after it', () => {
    expect(followUpOpen(rehearsal({ expectedOn: '2026-02-11' }), TODAY)).toBe(false);
    expect(followUpOpen(rehearsal({ expectedOn: TODAY }), TODAY)).toBe(true);
    expect(followUpOpen(rehearsal({ expectedOn: '2026-01-01' }), TODAY)).toBe(true);
    expect(followUpOpen(rehearsal(), TODAY)).toBe(false);
  });
});

describe('successRatio', () => {
  it('counts "As I planned" over the counted rehearsals that were followed up', () => {
    const list = [
      rehearsal({ id: 'a', followUp: { happened: true, result: 'chosen' } }),
      rehearsal({ id: 'b', followUp: { happened: true, result: 'partly' } }),
      rehearsal({ id: 'c', followUp: { happened: false } }),
      rehearsal({ id: 'd' }),
      rehearsal({ id: 'e', sample: true, followUp: { happened: true, result: 'chosen' } }),
      rehearsal({
        id: 'f',
        deletedAt: NOW.toISOString(),
        followUp: { happened: true, result: 'chosen' },
      }),
    ];
    expect(successRatio(list)).toEqual({ chosen: 1, count: 2 });
    expect(successRatio([])).toEqual({ chosen: 0, count: 0 });
  });
});

describe('byDate', () => {
  it('sorts soonest first, undated last, ties by creation', () => {
    const list = [
      rehearsal({ id: 'none' }),
      rehearsal({ id: 'late', expectedOn: '2026-03-01' }),
      rehearsal({ id: 'soon-b', expectedOn: '2026-02-12', createdAt: '2026-01-02T00:00:00.000Z' }),
      rehearsal({ id: 'soon-a', expectedOn: '2026-02-12' }),
    ];
    expect(byDate(list).map((r) => r.id)).toEqual(['soon-a', 'soon-b', 'late', 'none']);
  });
});

describe('statusLabelsFrom', () => {
  it("falls back to '' before the scope loads", () => {
    expect(statusLabelsFrom([''])).toEqual({ planned: '', due: '', followedUp: '' });
  });
});

describe('toListItem', () => {
  it('shows the moment, then the date and row status', () => {
    expect(toListItem(complete(), LABELS, TODAY)).toEqual({
      id: 'r1',
      title: 'Sunday lunch',
      subtitle: '<2026-02-15> · Planned',
      done: true,
    });
  });

  it('leaves out a missing date and falls back to other text for a title', () => {
    const item = toListItem(rehearsal({ trigger: '', promise: 'Stay calm' }), LABELS, TODAY);
    expect(item.title).toBe('Stay calm');
    expect(item.subtitle).toBe('Planned');
  });

  it('marks a sample with the Example chip and never as done', () => {
    const item = toListItem(complete({ sample: true }), LABELS, TODAY);
    expect(item.chips).toEqual([{ label: 'Example' }]);
    expect(item.done).toBe(false);
  });
});

describe('isDraftWorthSaving', () => {
  it('needs typed text in a free-text field, not a date alone', () => {
    expect(isDraftWorthSaving({ trigger: '' })).toBe(false);
    expect(isDraftWorthSaving({ trigger: ' ', usualReaction: '' })).toBe(false);
    expect(isDraftWorthSaving({ trigger: 'S' })).toBe(true);
    expect(isDraftWorthSaving({ trigger: '', promise: 'x' })).toBe(true);
  });
});

describe('rehearsalEdit and editRehearsal', () => {
  it('turns an empty or invalid date into undefined on the draft path', () => {
    expect(rehearsalEdit({ expectedOn: '' })).toEqual({ expectedOn: undefined });
    expect(rehearsalEdit({ expectedOn: '2026-02-30' })).toEqual({ expectedOn: undefined });
    expect(rehearsalEdit({ expectedOn: '2026-02-28' })).toEqual({ expectedOn: '2026-02-28' });
    expect(rehearsalEdit({ trigger: 'x' })).toEqual({ trigger: 'x' });
  });

  it('a cleared date is removed from the stored record', () => {
    const [edited] = editRehearsal([complete()], 'r1', { expectedOn: '' });
    expect('expectedOn' in edited).toBe(false);
  });

  it('an edit makes a sample the user’s own and leaves other and deleted records alone', () => {
    const deleted = rehearsal({ id: 'd', deletedAt: NOW.toISOString() });
    const [edited, other, gone] = editRehearsal(
      [rehearsal({ sample: true }), rehearsal({ id: 'r2' }), deleted],
      'r1',
      { cost: 'A lot' },
    );
    expect(edited.cost).toBe('A lot');
    expect(edited.sample).toBeUndefined();
    expect(other.cost).toBeUndefined();
    expect(editRehearsal([deleted], 'd', { cost: 'x' })[0]).toBe(deleted);
    expect(gone).toBe(deleted);
  });
});

describe('promiseSync', () => {
  it('adds a promise once the line and the date are both set', () => {
    expect(promiseSync(rehearsal({ promise: 'Answer calmly.' }), null)).toBeNull();
    expect(promiseSync(rehearsal({ expectedOn: '2026-02-15' }), null)).toBeNull();
    expect(
      promiseSync(rehearsal({ promise: '  Answer calmly. ', expectedOn: '2026-02-15' }), null),
    ).toEqual({
      kind: 'add',
      commitment: {
        text: 'Answer calmly.',
        dueDate: '2026-02-15',
        toWhom: 'self',
        source: { exerciseId: 'h1-rehearsal', recordId: 'r1' },
      },
    });
  });

  it('resolves a new promise at once when the follow-up already recorded an outcome', () => {
    const late = rehearsal({ promise: 'Answer calmly.', expectedOn: '2026-02-05' });
    expect(
      promiseSync({ ...late, followUp: { happened: true, result: 'chosen', kept: 'kept' } }, null),
    ).toMatchObject({ kind: 'add', resolveAs: 'kept' });
    expect(
      promiseSync(
        { ...late, followUp: { happened: true, result: 'reacted', kept: 'broken' } },
        null,
      ),
    ).toMatchObject({ kind: 'add', resolveAs: 'broken' });
    expect(promiseSync({ ...late, followUp: { happened: false } }, null)).not.toHaveProperty(
      'resolveAs',
    );
  });

  it('never syncs a sample', () => {
    expect(promiseSync(complete({ sample: true }), null)).toBeNull();
  });

  it('updates only what differs while the promise is open', () => {
    const linked = complete({ commitmentId: 'p1' });
    expect(promiseSync(linked, commitment())).toBeNull();
    expect(promiseSync({ ...linked, promise: 'Stay calm.' }, commitment())).toEqual({
      kind: 'update',
      id: 'p1',
      edit: { text: 'Stay calm.' },
    });
    expect(promiseSync({ ...linked, expectedOn: '2026-02-20' }, commitment())).toEqual({
      kind: 'update',
      id: 'p1',
      edit: { dueDate: '2026-02-20' },
    });
  });

  it('clears the due date with the date but never pushes an empty promise line', () => {
    const linked = complete({ commitmentId: 'p1' });
    expect(promiseSync({ ...linked, expectedOn: undefined }, commitment())).toEqual({
      kind: 'update',
      id: 'p1',
      edit: { dueDate: '' },
    });
    expect(promiseSync({ ...linked, promise: '  ' }, commitment())).toBeNull();
  });

  it('leaves a resolved promise alone', () => {
    const linked = complete({ commitmentId: 'p1', promise: 'Changed' });
    expect(promiseSync(linked, commitment({ status: 'kept' }))).toBeNull();
  });
});

describe('follow-up rules', () => {
  it('pre-selects Kept for As I planned, Broken for The old way, nothing for Partly', () => {
    expect(defaultKept('chosen')).toBe('kept');
    expect(defaultKept('reacted')).toBe('broken');
    expect(defaultKept('partly')).toBeUndefined();
  });

  it('needs Kept or Broken once it happened', () => {
    expect(followUpValid({ happened: false })).toBe(true);
    expect(followUpValid({ happened: true, result: 'partly' })).toBe(false);
    expect(followUpValid({ happened: true, kept: 'broken' })).toBe(true);
  });

  it('stores only what applies', () => {
    expect(tidyFollowUp({ happened: false, result: 'chosen', kept: 'kept' })).toEqual({
      happened: false,
    });
    expect(tidyFollowUp({ happened: true, result: 'partly', kept: 'kept', learned: '  ' })).toEqual(
      { happened: true, result: 'partly', kept: 'kept' },
    );
  });
});

describe('rehearsalFromExample and liveSampleOf', () => {
  const example = {
    trigger: 'Sunday lunch',
    usualReaction: 'Short with him',
    cost: 'Ruined',
    chosenResponse: SCENE,
    promise: 'Answer calmly.',
  };

  it('reads a sample payload, with no date', () => {
    expect(rehearsalFromExample(example)).toEqual(example);
    expect(rehearsalFromExample({ trigger: 'Only this', cost: 3 })).toEqual({
      trigger: 'Only this',
    });
  });

  it('rejects an invalid payload', () => {
    expect(rehearsalFromExample(null)).toBeNull();
    expect(rehearsalFromExample({ promise: 'No trigger' })).toBeNull();
  });

  it('finds a still-flagged live sample of the same example', () => {
    const sample = rehearsal({ ...example, sample: true });
    expect(liveSampleOf([sample], example)).toBe(sample);
    expect(liveSampleOf([{ ...sample, sample: undefined }], example)).toBeUndefined();
    expect(liveSampleOf([{ ...sample, deletedAt: NOW.toISOString() }], example)).toBeUndefined();
  });
});

describe('removeRehearsal and restoreRehearsal', () => {
  it('tombstones, then restores', () => {
    const [removed] = removeRehearsal([rehearsal()], 'r1', NOW);
    expect(removed.deletedAt).toBe(NOW.toISOString());
    const [restored] = restoreRehearsal([removed], 'r1', NOW);
    expect(restored.deletedAt).toBeUndefined();
  });
});

describe('followUpOutcome', () => {
  it('is Kept or Broken only once the moment happened', () => {
    expect(followUpOutcome(undefined)).toBeUndefined();
    expect(followUpOutcome({ happened: false, kept: 'kept' })).toBeUndefined();
    expect(followUpOutcome({ happened: true, result: 'partly' })).toBeUndefined();
    expect(followUpOutcome({ happened: true, result: 'chosen', kept: 'kept' })).toBe('kept');
  });
});
