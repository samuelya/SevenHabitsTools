import { RoleGoal } from '../../shared/roles/role-goals.model';
import { Role } from '../../shared/roles/roles.model';
import {
  goalFromExample,
  isGoalDraftWorthSaving,
  liveSampleGoalOf,
  roleNamed,
} from './goals.logic';

const T0 = '2026-01-01T00:00:00.000Z';

function role(id: string, fields: Partial<Role> = {}): Role {
  return { id, createdAt: T0, updatedAt: T0, name: id, order: 0, ...fields };
}

function goal(id: string, fields: Partial<RoleGoal> = {}): RoleGoal {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    roleId: 'dad',
    what: 'One evening',
    horizon: 'year',
    status: 'open',
    steps: [],
    ...fields,
  };
}

const EXAMPLE = {
  role: { name: 'Dad', description: 'Being around.' },
  what: 'One evening a week',
  why: "She's twelve.",
  how: '',
  horizon: 'threeYears',
  steps: [{ text: 'Ask her', done: true }, { text: '  ' }, 'junk', { text: 'Calendar' }],
};

describe('goals page logic (#291)', () => {
  it('saves a goal draft on the first typed character of "what"', () => {
    expect(isGoalDraftWorthSaving({ what: '' })).toBe(false);
    expect(isGoalDraftWorthSaving({ what: '  ' })).toBe(false);
    expect(isGoalDraftWorthSaving({ what: 'O' })).toBe(true);
  });

  it('goalFromExample() reads the role, the goal and up to five steps with text, undone', () => {
    let n = 0;
    const example = goalFromExample(EXAMPLE, () => `k${n++}`);
    expect(example).toEqual({
      role: { name: 'Dad', description: 'Being around.', order: 0 },
      goal: {
        what: 'One evening a week',
        why: "She's twelve.",
        horizon: 'threeYears',
        status: 'open',
        steps: [
          { key: 'k0', text: 'Ask her', done: false },
          { key: 'k1', text: 'Calendar', done: false },
        ],
      },
    });
  });

  it('goalFromExample() defaults the horizon and rejects a role example or junk', () => {
    expect(goalFromExample({ ...EXAMPLE, horizon: 'decade' }, () => 'k')?.goal.horizon).toBe(
      'year',
    );
    expect(goalFromExample({ name: 'Dad' }, () => 'k')).toBeNull();
    expect(goalFromExample({ what: 'x' }, () => 'k')).toBeNull();
    expect(goalFromExample(null, () => 'k')).toBeNull();
  });

  it('roleNamed() finds a live role by name, an active one first, else an archived one', () => {
    const roles = [role('a', { name: 'Dad', archived: true }), role('b', { name: 'Dad' })];
    expect(roleNamed(roles, 'Dad')?.id).toBe('b');
    expect(roleNamed([role('a', { name: 'Dad', archived: true })], 'Dad')?.id).toBe('a');
    expect(roleNamed([role('c', { name: 'Dad', deletedAt: T0 })], 'Dad')).toBeUndefined();
  });

  it('liveSampleGoalOf() finds an untouched sample of the same role and what', () => {
    const goals = [
      goal('a', { sample: true }),
      goal('b', { sample: true, roleId: 'friend' }),
      goal('c', { sample: true, deletedAt: T0 }),
    ];
    expect(liveSampleGoalOf(goals, 'dad', 'One evening')?.id).toBe('a');
    expect(liveSampleGoalOf([goal('d')], 'dad', 'One evening')).toBeUndefined();
  });
});
