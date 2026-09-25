import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import {
  Commitment,
  COMMITMENTS_MODEL_KEY,
  COMMITMENTS_PATH,
  registerCommitmentsModel,
} from './commitments.model';

// Vitest runs with `isolate: false`: re-assert the registration rather than reset it.
beforeEach(() => registerCommitmentsModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === COMMITMENTS_MODEL_KEY);
  if (!found) {
    throw new Error('commitments model was not registered');
  }
  return found;
}

const FULL: Commitment = {
  id: 'c1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  text: 'Send the report to Dina by Friday.',
  toWhom: 'other',
  personName: 'Dina',
  dueDate: '2026-01-09',
  status: 'broken',
  resolvedOn: '2026-01-10',
  repairNote: 'Sent a draft on Monday.',
  source: { exerciseId: 'h1-circle', recordId: 'r1' },
  sample: false,
};

describe('commitments model (shared.commitments)', () => {
  it('registers at shared.commitments with an empty default', () => {
    expect(registration().path).toBe(COMMITMENTS_PATH);
    expect(registration().defaults()).toEqual([]);
  });

  it('is registered by the eager model registry, with no page ever loaded (#57 design check)', async () => {
    await import('../../model-registry');
    expect(getRegisteredModels().some((model) => model.key === COMMITMENTS_MODEL_KEY)).toBe(true);
  });

  it('validates an empty array, a full record and a minimal one', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL])).toBe(true);
    const minimal: Commitment = {
      id: 'c2',
      createdAt: FULL.createdAt,
      updatedAt: FULL.updatedAt,
      text: 'Call Mum.',
      toWhom: 'self',
      status: 'open',
    };
    expect(registration().validate?.([minimal])).toBe(true);
  });

  it('accepts any source exerciseId string, with or without a recordId', () => {
    expect(registration().validate?.([{ ...FULL, source: { exerciseId: 'h3-week' } }])).toBe(true);
  });

  it('rejects a wrong shape', () => {
    const withoutText: Record<string, unknown> = { ...FULL };
    delete withoutText['text'];
    expect(registration().validate?.([withoutText])).toBe(false);
    expect(registration().validate?.([{ ...FULL, toWhom: 'boss' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, status: 'done' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, dueDate: 5 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, source: 'h1-circle' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, source: { recordId: 'r1' } }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, sample: 'yes' }])).toBe(false);
    expect(registration().validate?.({})).toBe(false);
  });

  // Review finding 1 (PR #282): a stored date must be a real `YYYY-MM-DD`.
  it('rejects a due or resolved date that is not a real calendar date', () => {
    expect(registration().validate?.([{ ...FULL, dueDate: '2026-13-01' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, dueDate: '2026-02-30' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, dueDate: 'soon' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, resolvedOn: '2026-1-10' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL, resolvedOn: '' }])).toBe(false);
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ shared: { commitments: [FULL] } });
    expect(issues.filter((issue) => issue.path === COMMITMENTS_PATH)).toEqual([]);
    const broken = validateDocument({ shared: { commitments: [{ ...FULL, status: 'nope' }] } });
    expect(broken.filter((issue) => issue.path === COMMITMENTS_PATH)).toHaveLength(1);
  });
});
