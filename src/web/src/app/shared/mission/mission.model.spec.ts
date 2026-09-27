import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { MISSION_MODEL_KEY, MISSION_PATH, Mission, registerMissionModel } from './mission.model';

// Vitest runs with `isolate: false`: re-assert the registration rather than reset it.
beforeEach(() => registerMissionModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === MISSION_MODEL_KEY);
  if (!found) {
    throw new Error('mission model was not registered');
  }
  return found;
}

const FULL: Mission = {
  id: 'm1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  values: ['presence', 'time'],
  principles: ['Integrity'],
  roleLines: [{ roleId: 'r1', text: 'the parent who asks a second question.' }],
  toBe: ['calm under pressure'],
  toDo: ['teach what I know'],
  draft: 'I want to be present.',
  checklist: { roles: true, gladToLive: false },
  versions: [
    { id: 'v1', savedAt: '2026-01-02T00:00:00.000Z', text: 'I want to be present.' },
    { id: 'v2', savedAt: '2026-01-03T00:00:00.000Z', text: 'Present.', note: 'shorter' },
  ],
  review: { interval: 'monthly', nextAt: '2026-02-03', lastReviewedAt: '2026-01-03' },
};

const validate = (value: unknown) => registration().validate?.(value);

describe('mission model (habits.h2.mission)', () => {
  it('registers at habits.h2.mission with a null default', () => {
    expect(registration().path).toBe(MISSION_PATH);
    expect(registration().defaults()).toBeNull();
  });

  it('is registered by the eager model registry, with no page ever loaded', async () => {
    await import('../../model-registry');
    expect(getRegisteredModels().some((model) => model.key === MISSION_MODEL_KEY)).toBe(true);
  });

  it('validates null, a full record and one without the optional review', () => {
    expect(validate(null)).toBe(true);
    expect(validate(FULL)).toBe(true);
    const withoutReview: Record<string, unknown> = { ...FULL, checklist: {}, versions: [] };
    delete withoutReview['review'];
    expect(validate(withoutReview)).toBe(true);
  });

  it.each([
    ['a value that is not a string', { values: [1] }],
    ['a role line without roleId', { roleLines: [{ text: 'x' }] }],
    ['a draft that is not a string', { draft: null }],
    ['an unknown review key', { checklist: { mood: true } }],
    ['a review answer that is not boolean', { checklist: { roles: 'yes' } }],
    ['a version with an empty savedAt', { versions: [{ id: 'v', savedAt: '', text: 'x' }] }],
    [
      'a version with a numeric note',
      { versions: [{ id: 'v', savedAt: FULL.createdAt, text: 'x', note: 1 }] },
    ],
    ['an unknown review interval', { review: { interval: 'weekly' } }],
    ['an impossible nextAt', { review: { interval: 'monthly', nextAt: '2026-13-01' } }],
    ['missing lists', { toBe: undefined }],
  ])('rejects %s', (_name, change) => {
    expect(validate({ ...FULL, ...change })).toBe(false);
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h2: { mission: FULL } } });
    expect(issues.filter((issue) => issue.path === MISSION_PATH)).toEqual([]);
    const broken = validateDocument({ habits: { h2: { mission: { ...FULL, versions: 'v1' } } } });
    expect(broken.filter((issue) => issue.path === MISSION_PATH)).toHaveLength(1);
  });
});
