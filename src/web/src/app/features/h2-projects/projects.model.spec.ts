import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  PROJECTS_MODEL_KEY,
  PROJECTS_PATH,
  PROJECTS_ROUTE,
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

  it('registers the exercise at order 70 on the Habit 2 hub with its short title', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === PROJECTS_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: 'h2-projects',
      habit: 'h2',
      titleKey: 'habits.exercises.h2-projects.title',
      shortTitleKey: 'habits.exercises.h2-projects.shortTitle',
      icon: 'flag',
      route: PROJECTS_ROUTE,
      order: 70,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
    expect(PROJECTS_ROUTE).toBe('habits/h2/projects');
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

  it('accepts more than five criteria: the cap is a form rule', () => {
    const criteria = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(registration().validate?.([{ ...FULL_ITEM, criteria }])).toBe(true);
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
