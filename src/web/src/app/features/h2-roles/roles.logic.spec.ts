import { Role } from '../../shared/roles/roles.model';
import {
  RoleLabels,
  MAX_TOKEN,
  VALUE_TOKEN,
  checklistLabelsFrom,
  checklistLoaded,
  countedGoals,
  countedRoles,
  doneChecklist,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  liveSampleOf,
  ratingLine,
  roleEditFields,
  roleFromExample,
  summarize,
  toListItem,
} from './roles.logic';
import { RoleGoal } from '../../shared/roles/role-goals.model';

const T0 = '2026-01-01T00:00:00.000Z';

function role(id: string, fields: Partial<Role> = {}): Role {
  return { id, createdAt: T0, updatedAt: T0, name: id, order: 0, ...fields };
}

const LABELS: RoleLabels = {
  builtIn: { renewal: 'Sharpen the Saw' },
  builtInText: 'Built-in',
  example: 'Example',
  ratingTemplate: `${VALUE_TOKEN} of ${MAX_TOKEN}`,
  formatNumber: (value) => String(value),
  goalCount: (count) => `${count} goals`,
};

const CHECKLIST = checklistLabelsFrom(['Add a role', 'Rate', 'Note', 'Goal']);

function goal(id: string, roleId: string, fields: Partial<RoleGoal> = {}): RoleGoal {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    roleId,
    what: 'One evening a week',
    horizon: 'year',
    status: 'open',
    steps: [{ key: 'k', text: 'Ask her', done: false }],
    ...fields,
  };
}

describe('roles page logic (#59)', () => {
  it('is started by a counted role, not a sample or a deleted one', () => {
    expect(isStarted([])).toBe(false);
    expect(isStarted([role('a', { sample: true }), role('b', { deletedAt: T0 })])).toBe(false);
    expect(isStarted([role('a', { archived: true })])).toBe(true);
  });

  it('counts live, unarchived, non-sample roles for the hub', () => {
    const list = [
      role('a'),
      role('b', { archived: true }),
      role('c', { sample: true }),
      role('d', { deletedAt: T0 }),
      role('saw', { name: undefined, key: 'renewal' }),
    ];
    expect(countedRoles(list).map((r) => r.id)).toEqual(['a']);
    expect(hubStatus(list)).toEqual({ key: 'habits.exercises.h2-roles.roleCount', count: 1 });
    expect(hubStatus([role('c', { sample: true })])).toBeNull();
  });

  it('never counts the built-in: alone it is not started, has no count and no summary', () => {
    const saw = role('saw', { name: undefined, key: 'renewal', satisfaction: 4, note: 'Gym.' });
    const onlySaw = [saw, role('gone', { deletedAt: T0 })];
    expect(isStarted(onlySaw)).toBe(false);
    expect(hubStatus(onlySaw)).toBeNull();
    expect(summarize(onlySaw, [])).toBeNull();
    expect(doneChecklist(onlySaw, [], CHECKLIST).map((item) => item.met)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('opens the gate at three rated roles, one note and a goal with a step; the checklist agrees', () => {
    const goals = [goal('g', 'a')];
    const two = [role('a', { satisfaction: 3, note: 'Not yet.' }), role('b', { satisfaction: 4 })];
    expect(isComplete(two, goals)).toBe(false);
    expect(doneChecklist(two, goals, CHECKLIST).map((item) => item.met)).toEqual([
      true,
      false,
      true,
      true,
    ]);

    const three = [...two, role('c', { satisfaction: 2 })];
    expect(isComplete(three, goals)).toBe(true);
    expect(doneChecklist(three, goals, CHECKLIST).every((item) => item.met)).toBe(true);
    expect(isComplete(three, [])).toBe(false);

    const noNote = three.map((r) => ({ ...r, note: r.note ? '  ' : undefined }));
    expect(isComplete(noNote, goals)).toBe(false);
  });

  it('counts a goal toward the gate only with a step, not a sample, and for an active role (#291)', () => {
    const roles = [role('a'), role('b', { archived: true })];
    const met = (goals: RoleGoal[]) => doneChecklist(roles, goals, CHECKLIST)[3].met;
    expect(met([goal('g', 'a', { steps: [{ key: 'k', text: '  ', done: false }] })])).toBe(false);
    expect(met([goal('g', 'a', { sample: true })])).toBe(false);
    expect(met([goal('g', 'a', { deletedAt: T0 })])).toBe(false);
    expect(met([goal('g', 'b')])).toBe(false);
    expect(met([goal('g', 'a', { status: 'reached' })])).toBe(true);
    expect(countedGoals(roles, [goal('g', 'a'), goal('h', 'b')]).map((g) => g.id)).toEqual(['g']);
  });

  it('never counts samples, archived or deleted roles toward the gate', () => {
    const list = [
      role('a', { satisfaction: 3, note: 'x' }),
      role('b', { satisfaction: 3, sample: true }),
      role('c', { satisfaction: 3, archived: true }),
      role('d', { satisfaction: 3, deletedAt: T0 }),
    ];
    expect(isComplete(list, [goal('g', 'a')])).toBe(false);
    expect(doneChecklist([], [], CHECKLIST).map((item) => item.met)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('waits for real checklist labels before rendering', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(CHECKLIST)).toBe(true);
  });

  it('summarizes counted roles, null with none, average null until one is rated', () => {
    expect(summarize([role('s', { sample: true })], [])).toBeNull();
    expect(summarize([role('a')], [])).toEqual({
      count: 1,
      rated: 0,
      average: null,
      goals: 0,
      goalsWithStep: 0,
    });
    expect(
      summarize(
        [
          role('a', { satisfaction: 3 }),
          role('b', { satisfaction: 4 }),
          role('c', { satisfaction: 4 }),
        ],
        [goal('g1', 'a'), goal('g2', 'b', { steps: [] }), goal('g3', 'a', { sample: true })],
      ),
    ).toEqual({ count: 3, rated: 3, average: 11 / 3, goals: 2, goalsWithStep: 1 });
  });

  it('adds "2 goals" to the row subtitle once the role has a goal (#291)', () => {
    expect(toListItem(role('a', { description: 'Around' }), LABELS, 2).subtitle).toBe(
      'Around · 2 goals',
    );
    expect(toListItem(role('a'), LABELS, 0).subtitle).toBeUndefined();
  });

  it('builds a row: title, "3 of 5" and description, swatch, lock for the built-in', () => {
    expect(
      toListItem(
        role('a', { name: 'Dad', satisfaction: 3, description: 'Around.', color: 'blue' }),
        LABELS,
      ),
    ).toEqual({ id: 'a', title: 'Dad', subtitle: '3 of 5 · Around.', swatch: '#1565c0' });
    expect(toListItem(role('saw', { name: undefined, key: 'renewal' }), LABELS)).toEqual({
      id: 'saw',
      title: 'Sharpen the Saw',
      icon: 'lock',
      iconLabel: 'Built-in',
      deletable: false,
    });
    expect(toListItem(role('s', { sample: true }), LABELS).chips).toEqual([{ label: 'Example' }]);
  });

  it('writes both numbers of "3 of 5" in the active numerals', () => {
    const arabic = new Intl.NumberFormat('ar-EG');
    const labels: RoleLabels = {
      ...LABELS,
      ratingTemplate: `${VALUE_TOKEN} من ${MAX_TOKEN}`,
      formatNumber: (value) => arabic.format(value),
    };
    expect(ratingLine({ satisfaction: 3 }, labels)).toBe('٣ من ٥');
  });

  it('renders no rating before the template loads or when unrated', () => {
    expect(ratingLine({ satisfaction: 3 }, { ...LABELS, ratingTemplate: '' })).toBe('');
    expect(ratingLine({}, LABELS)).toBe('');
    expect(toListItem(role('a'), { ...LABELS, builtIn: {} }).subtitle).toBeUndefined();
  });

  it('saves a draft on the first typed character of the name only', () => {
    expect(isDraftWorthSaving({ name: '' })).toBe(false);
    expect(isDraftWorthSaving({ name: '  ' })).toBe(false);
    expect(isDraftWorthSaving({ name: undefined })).toBe(false);
    expect(isDraftWorthSaving({ name: 'D' })).toBe(true);
  });

  it('turns a cleared colour into undefined for the draft path, never null', () => {
    expect(roleEditFields({ color: null })).toEqual({ color: undefined });
    expect(roleEditFields({ color: 'red', note: '' })).toEqual({ color: 'red', note: '' });
    expect('color' in roleEditFields({ note: 'x' })).toBe(false);
  });

  it('reads a guide sample defensively and finds an untouched copy', () => {
    expect(roleFromExample({ name: 'Dad', description: 'Around.' })).toEqual({
      name: 'Dad',
      description: 'Around.',
      order: 0,
    });
    expect(roleFromExample({ name: 'Dad' })).toEqual({ name: 'Dad', order: 0 });
    expect(roleFromExample({ name: ' ' })).toBeNull();
    expect(roleFromExample(null)).toBeNull();
    expect(roleFromExample('Dad')).toBeNull();

    const list = [role('a', { name: 'Dad', sample: true }), role('b', { name: 'Friend' })];
    expect(liveSampleOf(list, { name: 'Dad' })?.id).toBe('a');
    expect(liveSampleOf(list, { name: 'Friend' })).toBeUndefined();
    expect(
      liveSampleOf([role('a', { name: 'Dad', sample: true, archived: true })], { name: 'Dad' }),
    ).toBeUndefined();
  });
});
