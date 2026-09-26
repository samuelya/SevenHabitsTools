import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { Role, ROLES_MODEL_KEY, ROLES_PATH, registerRolesModel } from './roles.model';

// Vitest runs with `isolate: false`: re-assert the registration rather than reset it.
beforeEach(() => registerRolesModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === ROLES_MODEL_KEY);
  if (!found) {
    throw new Error('roles model was not registered');
  }
  return found;
}

const FULL: Role = {
  id: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  name: 'Dad',
  description: 'Being around, not just providing.',
  color: 'blue',
  order: 1,
  archived: true,
  satisfaction: 3,
  note: 'Not yet.',
  sample: false,
};

const BUILT_IN: Role = {
  id: 'r0',
  createdAt: FULL.createdAt,
  updatedAt: FULL.updatedAt,
  key: 'renewal',
  order: 0,
};

describe('roles model (shared.roles)', () => {
  it('registers at shared.roles with an empty default', () => {
    expect(registration().path).toBe(ROLES_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('is registered by the eager model registry, with no page ever loaded', async () => {
    await import('../../model-registry');
    expect(getRegisteredModels().some((model) => model.key === ROLES_MODEL_KEY)).toBe(true);
  });

  it('validates an empty array, a full record, a minimal one and the built-in', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL, BUILT_IN])).toBe(true);
    expect(
      registration().validate?.([
        { id: 'r2', createdAt: FULL.createdAt, updatedAt: FULL.updatedAt, name: '', order: 2 },
      ]),
    ).toBe(true);
  });

  it('rejects a wrong shape', () => {
    const withoutOrder: Record<string, unknown> = { ...FULL };
    delete withoutOrder['order'];
    expect(registration().validate?.([withoutOrder])).toBe(false);
    expect(registration().validate?.([{ ...FULL, order: '1' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, key: 'boss' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, color: 'pink' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, name: 5 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, satisfaction: '3' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, archived: 'yes' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, sample: 1 }])).toBe(false);
    expect(registration().validate?.({})).toBe(false);
  });

  it('leaves business rules to logic: an out-of-range rating is still valid structure', () => {
    expect(registration().validate?.([{ ...FULL, satisfaction: 9 }])).toBe(true);
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ shared: { roles: [FULL, BUILT_IN] } });
    expect(issues.filter((issue) => issue.path === ROLES_PATH)).toEqual([]);
    const broken = validateDocument({ shared: { roles: [{ ...FULL, color: 'nope' }] } });
    expect(broken.filter((issue) => issue.path === ROLES_PATH)).toHaveLength(1);
  });
});
