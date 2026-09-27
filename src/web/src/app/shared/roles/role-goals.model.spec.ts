import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import {
  ROLE_GOALS_MODEL_KEY,
  ROLE_GOALS_PATH,
  RoleGoal,
  registerRoleGoalsModel,
} from './role-goals.model';

// Vitest runs with `isolate: false`: re-assert the registration rather than reset it.
beforeEach(() => registerRoleGoalsModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === ROLE_GOALS_MODEL_KEY);
  if (!found) {
    throw new Error('role goals model was not registered');
  }
  return found;
}

const FULL: RoleGoal = {
  id: 'g1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  roleId: 'r1',
  what: "One evening a week that's just us.",
  why: "She's twelve.",
  how: 'She suggests what we do.',
  horizon: 'threeYears',
  status: 'reached',
  resolvedOn: '2026-01-02',
  steps: [
    { key: 's1', text: 'Ask her which evening works.', done: true },
    { key: 's2', text: '', done: false },
  ],
  sample: false,
};

const MINIMAL: RoleGoal = {
  id: 'g2',
  createdAt: FULL.createdAt,
  updatedAt: FULL.updatedAt,
  roleId: 'r1',
  what: 'Call first',
  horizon: 'year',
  status: 'open',
  steps: [],
};

describe('role goals model (habits.h2.roleGoals)', () => {
  it('registers at habits.h2.roleGoals with an empty default', () => {
    expect(registration().path).toBe(ROLE_GOALS_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('is registered by the eager model registry, with no page ever loaded', async () => {
    await import('../../model-registry');
    expect(getRegisteredModels().some((model) => model.key === ROLE_GOALS_MODEL_KEY)).toBe(true);
  });

  it('validates an empty array, a full record and a minimal one', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL, MINIMAL])).toBe(true);
  });

  it.each<[string, Record<string, unknown>]>([
    ['no roleId', { roleId: undefined }],
    ['a numeric what', { what: 3 }],
    ['an unknown horizon', { horizon: 'decade' }],
    ['an unknown status', { status: 'paused' }],
    ['a malformed resolvedOn', { resolvedOn: '2026-13-01' }],
    ['an empty resolvedOn', { resolvedOn: '' }],
    ['steps not an array', { steps: {} }],
    ['a step without done', { steps: [{ key: 's', text: 'x' }] }],
    ['a step with a numeric key', { steps: [{ key: 1, text: 'x', done: false }] }],
    ['a string sample', { sample: 'yes' }],
    ['a numeric why', { why: 1 }],
  ])('rejects %s', (_label, change) => {
    expect(registration().validate?.([{ ...FULL, ...change }])).toBe(false);
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h2: { roleGoals: [FULL, MINIMAL] } } });
    expect(issues.filter((issue) => issue.path === ROLE_GOALS_PATH)).toEqual([]);
    const broken = validateDocument({ habits: { h2: { roleGoals: [{ ...FULL, status: 'x' }] } } });
    expect(broken.filter((issue) => issue.path === ROLE_GOALS_PATH)).toHaveLength(1);
  });
});
