import {
  activeRoles,
  archivedRoles,
  averageSatisfaction,
  builtInRole,
  canMove,
  editRole,
  findRole,
  insertRole,
  isBuiltIn,
  nextOrder,
  removeRole,
  reorder,
  restoreRole,
  roleLabel,
  setArchived,
  sortedRoles,
  tidyRole,
  tooMany,
  withBuiltIn,
} from './roles.logic';
import { Role } from './roles.model';

const NOW = new Date('2026-03-10T09:00:00.000Z');
const T0 = '2026-01-01T00:00:00.000Z';

function role(id: string, fields: Partial<Role> = {}): Role {
  return { id, createdAt: T0, updatedAt: T0, name: id, order: 0, ...fields };
}

const BUILT_IN = role('saw', { name: undefined, key: 'renewal', order: 0 });

describe('roles logic (shared.roles)', () => {
  it('sorts live roles by order and splits active from archived', () => {
    const list = [
      role('c', { order: 2 }),
      role('a', { order: 0 }),
      role('gone', { order: 1, deletedAt: T0 }),
      role('b', { order: 1, archived: true }),
    ];
    expect(sortedRoles(list).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(activeRoles(list).map((r) => r.id)).toEqual(['a', 'c']);
    expect(archivedRoles(list).map((r) => r.id)).toEqual(['b']);
    expect(sortedRoles([])).toEqual([]);
  });

  it('labels a typed role by name and the built-in by its translated label, blank before load', () => {
    expect(roleLabel(role('a', { name: 'Dad' }), { renewal: 'Sharpen the Saw' })).toBe('Dad');
    expect(roleLabel(BUILT_IN, { renewal: 'Sharpen the Saw' })).toBe('Sharpen the Saw');
    expect(roleLabel(BUILT_IN, {})).toBe('');
    expect(roleLabel({ name: undefined }, {})).toBe('');
    expect(isBuiltIn(BUILT_IN)).toBe(true);
    expect(isBuiltIn(role('a'))).toBe(false);
  });

  it('puts the next role after every live one', () => {
    expect(nextOrder([])).toBe(0);
    expect(nextOrder([role('a', { order: 3 }), role('b', { order: 9, deletedAt: T0 })])).toBe(4);
  });

  it('averages rated live roles only, null with none rated', () => {
    expect(averageSatisfaction([])).toBeNull();
    expect(averageSatisfaction([role('a')])).toBeNull();
    expect(
      averageSatisfaction([
        role('a', { satisfaction: 3 }),
        role('b', { satisfaction: 4 }),
        role('c'),
        role('d', { satisfaction: 1, deletedAt: T0 }),
      ]),
    ).toBe(3.5);
  });

  it('warns past seven live unarchived roles', () => {
    const seven = Array.from({ length: 7 }, (_, i) => role(`r${i}`, { order: i }));
    expect(tooMany(seven)).toBe(false);
    expect(tooMany([...seven, role('archived', { archived: true })])).toBe(false);
    expect(tooMany([...seven, role('deleted', { deletedAt: T0 })])).toBe(false);
    expect(tooMany([...seven, role('eighth', { order: 7 })])).toBe(true);
  });

  it('creates the built-in once, at order 0, moving live roles down', () => {
    const first = withBuiltIn([role('a', { order: 0 }), role('gone', { deletedAt: T0 })], NOW);
    const created = builtInRole(first.list)!;
    expect(created).toMatchObject({ id: first.id, key: 'renewal', order: 0 });
    expect(created.name).toBeUndefined();
    expect(findRole(first.list, 'a')?.order).toBe(1);
    expect(first.list.find((r) => r.id === 'gone')?.order).toBe(0);

    const again = withBuiltIn(first.list, NOW);
    expect(again.id).toBe(first.id);
    expect(again.list).toBe(first.list);
  });

  it('inserts a first counted role after the new built-in, and a sample without one', () => {
    const inserted = insertRole([], role('dad', { order: 5 }), NOW);
    expect(sortedRoles(inserted).map((r) => r.key ?? r.id)).toEqual(['renewal', 'dad']);
    expect(findRole(inserted, 'dad')?.order).toBe(1);

    const sample = insertRole([], role('friend', { sample: true }), NOW);
    expect(sample.map((r) => r.id)).toEqual(['friend']);
    expect(builtInRole(sample)).toBeUndefined();
  });

  it('edits fields, clears blanks and the colour, refuses renaming the built-in', () => {
    const list = [role('a', { color: 'red', description: 'x' }), BUILT_IN];
    const edited = editRole(
      list,
      'a',
      { name: 'Mum', description: '', color: null, satisfaction: 4, note: 'Mostly.' },
      NOW,
    );
    const a = findRole(edited, 'a')!;
    expect(a).toMatchObject({ name: 'Mum', satisfaction: 4, note: 'Mostly.' });
    expect('description' in a).toBe(false);
    expect('color' in a).toBe(false);
    expect(a.updatedAt).toBe(NOW.toISOString());

    const renamed = editRole(list, 'saw', { name: 'Gym', note: 'Run twice a week.' }, NOW);
    expect(findRole(renamed, 'saw')).toMatchObject({ key: 'renewal', note: 'Run twice a week.' });
    expect(findRole(renamed, 'saw')?.name).toBeUndefined();
    expect(editRole(list, 'saw', { name: 'Gym' }, NOW)).toBe(list);
  });

  it('never stores an empty or whitespace name: the last valid one stays', () => {
    const list = [role('a', { name: 'Dad' })];
    expect(editRole(list, 'a', { name: '' }, NOW)).toBe(list);
    expect(editRole(list, 'a', { name: '   ' }, NOW)).toBe(list);
    const noted = editRole(list, 'a', { name: ' ', note: 'Home by six.' }, NOW);
    expect(findRole(noted, 'a')).toMatchObject({ name: 'Dad', note: 'Home by six.' });
  });

  it('returns the same list for an edit that changes nothing, a sample included', () => {
    const list = [role('a', { color: 'red', satisfaction: 3 }), role('s', { sample: true })];
    expect(editRole(list, 'a', { color: 'red', satisfaction: 3 }, NOW)).toBe(list);
    expect(editRole(list, 'a', {}, NOW)).toBe(list);
    expect(editRole(list, 's', { color: null }, NOW)).toBe(list);
  });

  it('makes an edited sample the user own, bringing the built-in with it', () => {
    const edited = editRole([role('friend', { sample: true })], 'friend', { satisfaction: 4 }, NOW);
    expect(findRole(edited, 'friend')?.sample).toBeUndefined();
    expect(builtInRole(edited)).toBeDefined();
  });

  it('ignores edits to a deleted or unknown role', () => {
    const list = [role('a', { deletedAt: T0 })];
    expect(editRole(list, 'a', { name: 'b' }, NOW)).toBe(list);
    expect(editRole(list, 'zzz', { name: 'b' }, NOW)).toBe(list);
  });

  it('archives and unarchives, never the built-in', () => {
    const list = [role('a'), BUILT_IN];
    const archived = setArchived(list, 'a', true, NOW);
    expect(findRole(archived, 'a')?.archived).toBe(true);
    const back = setArchived(archived, 'a', false, NOW);
    expect('archived' in findRole(back, 'a')!).toBe(false);
    expect(setArchived(list, 'saw', true, NOW)).toBe(list);
    expect(setArchived(list, 'a', false, NOW)).toBe(list);
    expect(setArchived(list, 'zzz', true, NOW)).toBe(list);
  });

  it('makes an archived or moved sample the user own, bringing the built-in with it', () => {
    const list = [role('s', { sample: true, order: 0 }), role('t', { sample: true, order: 1 })];
    const archived = setArchived(list, 's', true, NOW);
    expect(findRole(archived, 's')?.sample).toBeUndefined();
    expect(builtInRole(archived)).toBeDefined();

    const moved = reorder(list, 't', 'up', NOW);
    expect(findRole(moved, 't')?.sample).toBeUndefined();
    expect(findRole(moved, 's')?.sample).toBe(true);
    expect(activeRoles(moved).map((r) => r.key ?? r.id)).toEqual(['renewal', 't', 's']);
  });

  it('moves within its group only, renumbering duplicate orders', () => {
    const list = [
      role('a', { order: 0 }),
      role('b', { order: 0, createdAt: '2026-01-02T00:00:00.000Z' }),
      role('x', { order: 1, archived: true }),
      role('c', { order: 2 }),
    ];
    expect(canMove(list, 'a', 'up')).toBe(false);
    expect(canMove(list, 'c', 'down')).toBe(false);
    expect(canMove(list, 'x', 'up')).toBe(false);
    expect(canMove(list, 'b', 'down')).toBe(true);

    const moved = reorder(list, 'b', 'up', NOW);
    expect(activeRoles(moved).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    const down = reorder(moved, 'b', 'down', NOW);
    expect(activeRoles(down).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(reorder(list, 'a', 'up', NOW)).toBe(list);
  });

  it('soft-deletes and restores, never the built-in', () => {
    const list = [role('a'), BUILT_IN];
    const removed = removeRole(list, 'a', NOW);
    expect(findRole(removed, 'a')).toBeNull();
    expect(removed.find((r) => r.id === 'a')?.deletedAt).toBe(NOW.toISOString());
    expect(findRole(restoreRole(removed, 'a', NOW), 'a')).not.toBeNull();
    expect(removeRole(list, 'saw', NOW)).toBe(list);
    expect(removeRole(list, 'zzz', NOW)).toBe(list);
    expect(restoreRole(list, 'a', NOW)).toBe(list);
  });

  it('finds archived roles by id, not deleted ones', () => {
    expect(findRole([role('a', { archived: true })], 'a')?.id).toBe('a');
    expect(findRole([role('a', { deletedAt: T0 })], 'a')).toBeNull();
  });

  it('tidies undefined keys, blank text, archived: false and an out-of-range rating', () => {
    const tidy = tidyRole({
      ...role('a'),
      description: '',
      note: undefined,
      archived: false,
      satisfaction: 7 as never,
    });
    expect(Object.keys(tidy).sort()).toEqual(['createdAt', 'id', 'name', 'order', 'updatedAt']);
  });
});
