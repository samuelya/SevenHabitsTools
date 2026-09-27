import {
  MAX_GOAL_STEPS,
  addStep,
  countedGoals,
  countsForRoles,
  editGoal,
  editStep,
  goalsForRole,
  hasStep,
  insertGoal,
  openSteps,
  removeGoal,
  removeGoalsForRole,
  removeStep,
  reopenGoal,
  restoreGoal,
  restoreGoalsForRole,
  setGoalStatus,
  tidyGoal,
  toggleStep,
} from './role-goals.logic';
import { RoleGoal } from './role-goals.model';
import { Role } from './roles.model';

const NOW = new Date('2026-03-10T09:00:00.000Z');
const LATER = new Date('2026-03-11T09:00:00.000Z');

function goal(fields: Partial<RoleGoal> & Pick<RoleGoal, 'id'>): RoleGoal {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    roleId: 'dad',
    what: 'One evening a week',
    horizon: 'year',
    status: 'open',
    steps: [],
    ...fields,
  };
}

const step = (key: string, text: string, done = false) => ({ key, text, done });

function role(id: string, fields: Partial<Role> = {}): Role {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: id,
    order: 0,
    ...fields,
  };
}

const ROLES = [role('dad'), role('friend')];

describe('role goals logic', () => {
  it('goalsForRole(): live goals of the role, newest first', () => {
    const list = [
      goal({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      goal({ id: 'b', createdAt: '2026-02-01T00:00:00.000Z' }),
      goal({ id: 'c', deletedAt: '2026-02-02T00:00:00.000Z' }),
      goal({ id: 'd', roleId: 'friend' }),
    ];
    expect(goalsForRole(list, 'dad').map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('hasStep(): a step counts only with text (trimmed)', () => {
    expect(hasStep(goal({ id: 'a' }))).toBe(false);
    expect(hasStep(goal({ id: 'a', steps: [step('s', '   ')] }))).toBe(false);
    expect(hasStep(goal({ id: 'a', steps: [step('s', 'Ask her', true)] }))).toBe(true);
  });

  it('openSteps(): undone steps with text of live, open goals the user made', () => {
    const list = [
      goal({ id: 'a', steps: [step('s1', ' Ask her ', false), step('s2', 'Done', true)] }),
      goal({ id: 'b', status: 'reached', steps: [step('s3', 'x')] }),
      goal({ id: 'c', sample: true, steps: [step('s4', 'x')] }),
      goal({ id: 'd', deletedAt: NOW.toISOString(), steps: [step('s5', 'x')] }),
      goal({ id: 'e', roleId: 'friend', steps: [step('s6', ''), step('s7', 'Call')] }),
    ];
    expect(openSteps(list, ROLES)).toEqual([
      { goalId: 'a', roleId: 'dad', key: 's1', text: 'Ask her' },
      { goalId: 'e', roleId: 'friend', key: 's7', text: 'Call' },
    ]);
  });

  it("openSteps(): none of an archived, deleted, sample or unknown role's goals", () => {
    const roles = [
      role('dad'),
      role('coach', { archived: true }),
      role('old', { deletedAt: NOW.toISOString() }),
      role('tried', { sample: true }),
    ];
    const list = ['dad', 'coach', 'old', 'tried', 'gone'].map((roleId) =>
      goal({ id: roleId, roleId, steps: [step(`k-${roleId}`, 'Ask')] }),
    );
    expect(openSteps(list, roles).map((open) => open.roleId)).toEqual(['dad']);
    expect(countedGoals(list, roles).map((g) => g.id)).toEqual(['dad']);
  });

  it("countsForRoles(): each row's counted goals, zero included, archived rows too", () => {
    const list = [
      goal({ id: 'a' }),
      goal({ id: 'b' }),
      goal({ id: 'c', deletedAt: NOW.toISOString() }),
      goal({ id: 'd', sample: true }),
      goal({ id: 'e', roleId: 'other' }),
      goal({ id: 'f', roleId: 'tried' }),
      goal({ id: 'g', roleId: 'coach' }),
    ];
    const roles = [...ROLES, role('tried', { sample: true }), role('coach', { archived: true })];
    const counts = countsForRoles(list, roles);
    expect(counts.get('dad')).toBe(2);
    expect(counts.get('friend')).toBe(0);
    expect(counts.get('tried')).toBe(0);
    expect(counts.get('coach')).toBe(1);
    expect(counts.has('other')).toBe(false);
  });

  it("tidyGoal() drops undefined, cleared why/how and an open goal's resolvedOn", () => {
    const tidy = tidyGoal(goal({ id: 'a', why: '', how: undefined, resolvedOn: '2026-01-01' }));
    expect('why' in tidy || 'how' in tidy || 'resolvedOn' in tidy).toBe(false);
  });

  it('insertGoal() appends once', () => {
    const record = goal({ id: 'a', why: '' });
    const list = insertGoal([], record);
    expect(list).toEqual([tidyGoal(record)]);
    expect(insertGoal(list, record)).toBe(list);
  });

  describe('editGoal()', () => {
    const list = [goal({ id: 'a', why: 'Because', sample: true })];

    it("edits fields, makes a sample the user's own and bumps updatedAt", () => {
      const [edited] = editGoal(list, 'a', { what: 'Two evenings', horizon: 'lifetime' }, NOW);
      expect(edited).toMatchObject({ what: 'Two evenings', horizon: 'lifetime' });
      expect(edited.sample).toBeUndefined();
      expect(edited.updatedAt).toBe(NOW.toISOString());
    });

    it('clears why with an empty string', () => {
      expect('why' in editGoal(list, 'a', { why: '' }, NOW)[0]).toBe(false);
    });

    it('returns the same list for a blank what, a bad horizon, a no-op or an unknown id', () => {
      expect(editGoal(list, 'a', { what: '  ' }, NOW)).toBe(list);
      expect(editGoal(list, 'a', { horizon: 'decade' as never }, NOW)).toBe(list);
      expect(editGoal(list, 'a', { why: 'Because' }, NOW)).toBe(list);
      expect(editGoal(list, 'x', { what: 'Other' }, NOW)).toBe(list);
    });
  });

  it('setGoalStatus() records today; the same status again is a no-op; reopenGoal() clears it', () => {
    const list = [goal({ id: 'a' })];
    const reached = setGoalStatus(list, 'a', 'reached', '2026-03-10', NOW);
    expect(reached[0]).toMatchObject({ status: 'reached', resolvedOn: '2026-03-10' });
    expect(setGoalStatus(reached, 'a', 'reached', '2026-03-11', LATER)).toBe(reached);
    const dropped = setGoalStatus(reached, 'a', 'dropped', '2026-03-11', LATER);
    expect(dropped[0]).toMatchObject({ status: 'dropped', resolvedOn: '2026-03-11' });
    const reopened = reopenGoal(dropped, 'a', LATER);
    expect(reopened[0].status).toBe('open');
    expect('resolvedOn' in reopened[0]).toBe(false);
    expect(reopenGoal(reopened, 'a', LATER)).toBe(reopened);
  });

  describe('steps', () => {
    it('addStep() appends an empty step and refuses a sixth', () => {
      let list: readonly RoleGoal[] = [goal({ id: 'a' })];
      for (let i = 0; i < MAX_GOAL_STEPS; i++) {
        list = addStep(list, 'a', `k${i}`, NOW);
      }
      expect(list[0].steps).toHaveLength(MAX_GOAL_STEPS);
      expect(list[0].steps[0]).toEqual({ key: 'k0', text: '', done: false });
      expect(addStep(list, 'a', 'k9', NOW)).toBe(list);
    });

    it('editStep(), toggleStep() and removeStep() change one step; no-ops keep the list', () => {
      const list = [goal({ id: 'a', steps: [step('s1', 'Ask'), step('s2', 'Plan')] })];
      expect(editStep(list, 'a', 's1', 'Ask her', NOW)[0].steps[0].text).toBe('Ask her');
      expect(editStep(list, 'a', 's1', 'Ask', NOW)).toBe(list);
      expect(toggleStep(list, 'a', 's2', true, NOW)[0].steps[1].done).toBe(true);
      expect(toggleStep(list, 'a', 's2', false, NOW)).toBe(list);
      expect(removeStep(list, 'a', 's1', NOW)[0].steps.map((s) => s.key)).toEqual(['s2']);
      expect(removeStep(list, 'a', 'nope', NOW)).toBe(list);
    });
  });

  it('removeGoal() and restoreGoal() round-trip; unknown ids keep the list', () => {
    const list = [goal({ id: 'a' })];
    const removed = removeGoal(list, 'a', NOW);
    expect(removed[0].deletedAt).toBe(NOW.toISOString());
    expect(removeGoal(removed, 'a', LATER)).toBe(removed);
    const restored = restoreGoal(removed, 'a', LATER);
    expect('deletedAt' in restored[0]).toBe(false);
    expect(restoreGoal(restored, 'a', LATER)).toBe(restored);
  });

  it('removeGoalsForRole() marks the goals it deletes; restoreGoalsForRole() brings back only those', () => {
    const list = [
      goal({ id: 'a' }),
      goal({ id: 'b', deletedAt: NOW.toISOString() }),
      goal({ id: 'c', roleId: 'friend' }),
    ];
    // 'b' was deleted on its own at the very time the role later is: the marker, not the time, decides.
    const removed = removeGoalsForRole(list, 'dad', NOW);
    expect(removed.map((g) => [g.deletedAt, g.deletedWithRole])).toEqual([
      [NOW.toISOString(), 'dad'],
      [NOW.toISOString(), undefined],
      [undefined, undefined],
    ]);
    expect(removeGoalsForRole(removed, 'dad', LATER)).toBe(removed);
    const restored = restoreGoalsForRole(removed, 'dad', LATER);
    expect(restored.map((g) => g.deletedAt)).toEqual([undefined, NOW.toISOString(), undefined]);
    expect('deletedWithRole' in restored[0]).toBe(false);
    expect(restoreGoalsForRole(restored, 'dad', LATER)).toBe(restored);
    expect(restoreGoalsForRole(removed, 'friend', LATER)).toBe(removed);
  });
});
