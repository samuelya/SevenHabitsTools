import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import {
  PROJECTS_MODEL_KEY,
  PROJECTS_PATH,
  Project,
  registerProjectsModel,
} from './projects.model';

// Vitest here runs with `isolate: false` (shared module state): re-assert, don't reset.
beforeEach(() => registerProjectsModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === PROJECTS_MODEL_KEY);
  if (!found) {
    throw new Error('h2-projects model was not registered');
  }
  return found;
}

const FULL_ITEM: Project = {
  id: 'p1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  name: "Mum's 70th birthday lunch",
  desiredResult: 'Everyone she loves in one room.',
  criteria: ['All four siblings came.'],
  deadline: '2026-10-12',
  steps: [
    { key: 's1', text: 'Ask each sibling which Sunday works.', done: true, date: '2026-09-05' },
    { key: 's2', text: 'Book the back room.', done: false },
  ],
  status: 'underWay',
  sample: false,
};

describe('h2-projects model', () => {
  it('registers at habits.h2.projects with an empty default', () => {
    expect(registration().path).toBe(PROJECTS_PATH);
    expect(PROJECTS_PATH).toBe('habits.h2.projects');
    expect(registration().defaults()).toEqual([]);
  });

  it('validates an empty array, a fully filled project and a minimal one', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL_ITEM])).toBe(true);
    const minimal: Record<string, unknown> = { ...FULL_ITEM, criteria: [], steps: [] };
    delete minimal['desiredResult'];
    delete minimal['deadline'];
    delete minimal['sample'];
    expect(registration().validate?.([minimal])).toBe(true);
  });

  it('accepts every status and rejects an unknown one', () => {
    for (const status of ['planning', 'underWay', 'done', 'dropped']) {
      expect(registration().validate?.([{ ...FULL_ITEM, status }])).toBe(true);
    }
    expect(registration().validate?.([{ ...FULL_ITEM, status: 'paused' }])).toBe(false);
  });

  it('rejects malformed fields, steps and dates', () => {
    const bad: Record<string, unknown>[] = [
      { name: 3 },
      { desiredResult: 1 },
      { criteria: 'x' },
      { criteria: [1] },
      { deadline: '' },
      { deadline: '2026-02-30' },
      { steps: [{ key: 's', text: 'x' }] },
      { steps: [{ key: 's', text: 'x', done: 'no' }] },
      { steps: [{ text: 'x', done: false }] },
      { steps: [{ key: '', text: 'x', done: false }] },
      {
        steps: [
          { key: 's', text: 'x', done: false },
          { key: 's', text: 'y', done: true },
        ],
      },
      { steps: [{ key: 's', text: 'x', done: false, date: '' }] },
      { sample: 'yes' },
    ];
    for (const fields of bad) {
      expect(registration().validate?.([{ ...FULL_ITEM, ...fields }])).toBe(false);
    }
    const withoutSteps: Record<string, unknown> = { ...FULL_ITEM };
    delete withoutSteps['steps'];
    expect(registration().validate?.([withoutSteps])).toBe(false);
    expect(registration().validate?.({})).toBe(false);
  });

  it('accepts five criteria and rejects six, so an import never holds more than the form shows', () => {
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(registration().validate?.([{ ...FULL_ITEM, criteria: five }])).toBe(true);
    expect(registration().validate?.([{ ...FULL_ITEM, criteria: [...five, 'f'] }])).toBe(false);
  });

  it('accepts the same step key in two different projects', () => {
    const other = { ...FULL_ITEM, id: 'p2' };
    expect(registration().validate?.([FULL_ITEM, other])).toBe(true);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h2: { projects: [FULL_ITEM] } } });
    expect(issues.filter((issue) => issue.path === PROJECTS_PATH)).toEqual([]);
  });

  it('fails validateDocument() on an import with a bad step date', () => {
    const bad = { ...FULL_ITEM, steps: [{ key: 's', text: 'x', done: false, date: 'soon' }] };
    const issues = validateDocument({ habits: { h2: { projects: [bad] } } });
    expect(issues.some((issue) => issue.path === PROJECTS_PATH)).toBe(true);
  });
});
