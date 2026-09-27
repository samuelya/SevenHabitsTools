import { Mission } from './mission.model';
import {
  MAX_LINES,
  appendParagraph,
  canSaveVersion,
  checklistLabelsFrom,
  checklistLoaded,
  checklistMet,
  checklistWith,
  currentStatement,
  doneChecklist,
  editMission,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  maxFor,
  normaliseLine,
  roleLinesWith,
  sameLine,
  stepsDone,
  withLine,
  withVersion,
  withoutLine,
  wordCount,
} from './mission.logic';

const T0 = '2026-01-01T00:00:00.000Z';
const NOW = new Date('2026-01-05T10:00:00.000Z');

function mission(fields: Partial<Mission> = {}): Mission {
  return {
    id: 'm1',
    createdAt: T0,
    updatedAt: T0,
    values: [],
    principles: [],
    roleLines: [],
    toBe: [],
    toDo: [],
    draft: '',
    checklist: {},
    versions: [],
    ...fields,
  };
}

describe('lines', () => {
  it('normalises whitespace and compares case-insensitively', () => {
    expect(normaliseLine('  keeping   my\nword ')).toBe('keeping my word');
    expect(sameLine('Presence', ' presence ')).toBe(true);
    expect(sameLine('presence', 'present')).toBe(false);
  });

  it('adds a normalised line and reports why it did not', () => {
    const list = ['presence'];
    expect(withLine(list, '  time ', Infinity)).toEqual({
      list: ['presence', 'time'],
      outcome: 'added',
    });
    expect(withLine(list, '   ', Infinity)).toEqual({ list, outcome: 'empty' });
    expect(withLine(list, 'PRESENCE', Infinity)).toEqual({ list, outcome: 'duplicate' });
    const full = Array.from({ length: MAX_LINES }, (_, i) => `line ${i}`);
    expect(withLine(full, 'one more', MAX_LINES)).toEqual({ list: full, outcome: 'full' });
    expect(withLine(list, 'PRESENCE', Infinity).list).toBe(list);
  });

  it('caps only the step 4 lists', () => {
    expect(maxFor('toBe')).toBe(MAX_LINES);
    expect(maxFor('toDo')).toBe(MAX_LINES);
    expect(maxFor('values')).toBe(Infinity);
    expect(maxFor('principles')).toBe(Infinity);
  });

  it('removes by index and returns the same list for a missing index', () => {
    const list = ['a', 'b', 'c'];
    expect(withoutLine(list, 1)).toEqual(['a', 'c']);
    expect(withoutLine(list, 3)).toBe(list);
    expect(withoutLine(list, -1)).toBe(list);
  });
});

describe('editMission', () => {
  it('creates the record on the first edit worth saving, never on an empty one', () => {
    expect(editMission(null, { draft: '   ' }, NOW)).toBeNull();
    expect(editMission(null, { values: [] }, NOW)).toBeNull();
    const created = editMission(null, { values: ['time'] }, NOW);
    expect(created).toMatchObject({ values: ['time'], draft: '', versions: [], checklist: {} });
    expect(created?.createdAt).toBe(NOW.toISOString());
  });

  it('creates the record on a "No" checklist answer (#298 finding 4)', () => {
    expect(editMission(null, { checklist: { roles: false } }, NOW)).toMatchObject({
      checklist: { roles: false },
    });
  });

  it('returns the same record for a no-op and touches a real change', () => {
    const values = ['time'];
    const current = mission({ values });
    expect(editMission(current, { values }, NOW)).toBe(current);
    const edited = editMission(current, { draft: 'x' }, NOW);
    expect(edited).toMatchObject({ draft: 'x', updatedAt: NOW.toISOString(), id: 'm1' });
  });

  it('knows what is worth saving', () => {
    expect(isDraftWorthSaving({})).toBe(false);
    expect(isDraftWorthSaving({ draft: ' ' })).toBe(false);
    expect(isDraftWorthSaving({ roleLines: [] })).toBe(false);
    expect(isDraftWorthSaving({ checklist: {} })).toBe(false);
    expect(isDraftWorthSaving({ checklist: { roles: true } })).toBe(true);
    expect(isDraftWorthSaving({ toBe: ['calm'] })).toBe(true);
    expect(isDraftWorthSaving({ draft: 'I' })).toBe(true);
  });
});

describe('role lines and checks', () => {
  it('sets, replaces and drops an emptied role line', () => {
    const lines = [{ roleId: 'r1', text: 'a' }];
    expect(roleLinesWith(lines, 'r2', 'b')).toEqual([...lines, { roleId: 'r2', text: 'b' }]);
    expect(roleLinesWith(lines, 'r1', 'c')).toEqual([{ roleId: 'r1', text: 'c' }]);
    expect(roleLinesWith(lines, 'r1', 'a')).toBe(lines);
    expect(roleLinesWith(lines, 'r1', '  ')).toEqual([]);
    expect(roleLinesWith(lines, 'r9', '')).toBe(lines);
  });

  it('answers a review question, same object when unchanged', () => {
    const checklist = { roles: true };
    expect(checklistWith(checklist, 'roles', true)).toBe(checklist);
    expect(checklistWith(checklist, 'roles', false)).toEqual({ roles: false });
    expect(checklistWith(checklist, 'ownWords', true)).toEqual({ roles: true, ownWords: true });
  });
});

describe('draft', () => {
  it('counts whitespace-separated words, Arabic included', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount(' I keep\nmy  word ')).toBe(4);
    expect(wordCount('عايز أكون حاضر')).toBe(3);
  });

  it('appends a paragraph at the end', () => {
    expect(appendParagraph('', '  Call first. ')).toBe('Call first.');
    expect(appendParagraph('I want.\n\n  ', 'Call first.')).toBe('I want.\n\nCall first.');
    expect(appendParagraph('I want.', '  ')).toBe('I want.');
  });
});

describe('versions', () => {
  it('saves the trimmed draft as a new version, once per change', () => {
    const current = mission({ draft: ' I want to be present. ' });
    expect(canSaveVersion(current)).toBe(true);
    const saved = withVersion(current, 'v1', NOW);
    expect(saved.versions).toEqual([
      { id: 'v1', savedAt: NOW.toISOString(), text: 'I want to be present.' },
    ]);
    expect(currentStatement(saved)).toBe('I want to be present.');
    expect(canSaveVersion(saved)).toBe(false);
    expect(withVersion(saved, 'v2', NOW)).toBe(saved);
  });

  it('refuses an empty draft and keeps a note', () => {
    const empty = mission({ draft: '  ' });
    expect(canSaveVersion(empty)).toBe(false);
    expect(canSaveVersion(null)).toBe(false);
    expect(withVersion(empty, 'v1', NOW)).toBe(empty);
    expect(withVersion(mission({ draft: 'x' }), 'v1', NOW, ' first ').versions[0].note).toBe(
      'first',
    );
    expect(currentStatement(null)).toBe('');
  });
});

describe('gate, steps and hub', () => {
  const LABELS = checklistLabelsFrom(['Value', 'Role', 'Draft', 'Version']);

  it('meets nothing before the record exists', () => {
    expect(checklistMet(null)).toEqual({
      valueOrPrinciple: false,
      roleLine: false,
      draft: false,
      version: false,
    });
    expect(isComplete(null)).toBe(false);
    expect(isStarted(null)).toBe(false);
    expect(stepsDone(null)).toEqual([false, false, false, false, false, false]);
    expect(hubStatus(null)).toBeNull();
  });

  it('meets each item from the record, and done needs a version', () => {
    const drafted = mission({
      principles: ['Integrity'],
      roleLines: [
        { roleId: 'r1', text: ' ' },
        { roleId: 'r2', text: 'kind' },
      ],
      toBe: ['calm'],
      draft: 'I want',
    });
    expect(checklistMet(drafted)).toEqual({
      valueOrPrinciple: true,
      roleLine: true,
      draft: true,
      version: false,
    });
    expect(isComplete(drafted)).toBe(false);
    expect(stepsDone(drafted)).toEqual([false, true, true, false, true, false]);
    const saved = withVersion(drafted, 'v1', NOW);
    expect(isComplete(saved)).toBe(true);
    expect(doneChecklist(saved, LABELS)).toEqual([
      { label: 'Value', met: true },
      { label: 'Role', met: true },
      { label: 'Draft', met: true },
      { label: 'Version', met: true },
    ]);
  });

  it('shows words while drafting and the version count once saved', () => {
    expect(hubStatus(mission({ values: ['time'] }))).toBeNull();
    expect(hubStatus(mission({ draft: 'I keep my word' }))).toEqual({
      key: 'habits.exercises.h2-mission.draftWords',
      count: 4,
    });
    const saved = withVersion(mission({ draft: 'I keep my word' }), 'v1', NOW);
    expect(hubStatus(withVersion({ ...saved, draft: 'Again' }, 'v2', NOW))).toEqual({
      key: 'habits.exercises.h2-mission.versionCount',
      count: 2,
    });
  });

  it('gates labels on the scope having loaded', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLabelsFrom([''])).toEqual({
      valueOrPrinciple: '',
      roleLine: '',
      draft: '',
      version: '',
    });
    expect(checklistLoaded(LABELS)).toBe(true);
  });

  it('marks a started worksheet once the record exists', () => {
    expect(isStarted(mission())).toBe(true);
  });
});
