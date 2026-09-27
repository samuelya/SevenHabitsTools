import {
  ProjectLabels,
  SAMPLE_DEADLINE_IN_DAYS,
  allOpenSteps,
  canAddSteps,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editFields,
  editProject,
  finishedProjects,
  hubStatus,
  insertProject,
  isComplete,
  isDraftWorthSaving,
  isItemComplete,
  isOverdue,
  isStarted,
  liveSampleOf,
  progress,
  projectFromExample,
  removeProject,
  restoreProject,
  rowSubtitle,
  summarize,
  toListItem,
  underWayProjects,
} from './projects.logic';
import { Project, ProjectFields } from './projects.model';

const T0 = '2026-09-01T00:00:00.000Z';
const NOW = new Date('2026-09-10T10:00:00.000Z');
const TODAY = '2026-09-10';

function project(id: string, fields: Partial<Project> = {}): Project {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    name: `Project ${id}`,
    desiredResult: 'It went well.',
    criteria: [],
    steps: [
      { key: `${id}-1`, text: 'First', done: true },
      { key: `${id}-2`, text: 'Second', done: false },
    ],
    status: 'underWay',
    ...fields,
  };
}

const LABELS: ProjectLabels = {
  example: 'Example',
  overdue: 'Overdue',
  progress: (done, total) => `${done} of ${total} steps`,
  formatDate: (date) => `on ${date}`,
};

describe('one project', () => {
  it('opens the steps once "What done looks like" has text', () => {
    expect(canAddSteps({})).toBe(false);
    expect(canAddSteps({ desiredResult: '   ' })).toBe(false);
    expect(canAddSteps({ desiredResult: 'A lunch' })).toBe(true);
  });

  it('counts progress over steps with text', () => {
    expect(progress(project('a'))).toEqual({ done: 1, total: 2 });
    const blank = project('a', { steps: [{ key: 'x', text: ' ', done: true }] });
    expect(progress(blank)).toEqual({ done: 0, total: 0 });
  });

  it('is complete with a desired result, a step and status Done', () => {
    expect(isItemComplete(project('a', { status: 'done' }))).toBe(true);
    expect(isItemComplete(project('a'))).toBe(false);
    expect(isItemComplete(project('a', { status: 'done', steps: [] }))).toBe(false);
    expect(isItemComplete(project('a', { status: 'done', desiredResult: undefined }))).toBe(false);
  });

  it('is overdue past its deadline unless Done or Dropped', () => {
    expect(isOverdue({ deadline: '2026-09-09', status: 'planning' }, TODAY)).toBe(true);
    expect(isOverdue({ deadline: '2026-09-10', status: 'planning' }, TODAY)).toBe(false);
    expect(isOverdue({ deadline: '2026-09-09', status: 'done' }, TODAY)).toBe(false);
    expect(isOverdue({ deadline: '2026-09-09', status: 'dropped' }, TODAY)).toBe(false);
    expect(isOverdue({ status: 'underWay' }, TODAY)).toBe(false);
  });

  it('keeps a draft until text is typed in a text field', () => {
    const empty: Pick<ProjectFields, 'name' | 'desiredResult' | 'criteria' | 'steps'> = {
      name: '',
      criteria: [''],
      steps: [],
    };
    expect(isDraftWorthSaving(empty)).toBe(false);
    expect(isDraftWorthSaving({ ...empty, name: 'M' })).toBe(true);
    expect(isDraftWorthSaving({ ...empty, desiredResult: 'x' })).toBe(true);
    expect(isDraftWorthSaving({ ...empty, criteria: ['x'] })).toBe(true);
    expect(isDraftWorthSaving({ ...empty, steps: [{ key: 's', text: 'x', done: false }] })).toBe(
      true,
    );
  });
});

describe('the list', () => {
  const list = [
    project('a'),
    project('b', { status: 'planning', createdAt: '2026-09-05T00:00:00.000Z' }),
    project('c', { status: 'done' }),
    project('d', { status: 'dropped' }),
    project('e', { sample: true }),
    project('f', { deletedAt: T0 }),
  ];

  it('groups live projects, samples included: Under way and Finished', () => {
    expect(underWayProjects(list).map((p) => p.id)).toEqual(['a', 'b', 'e']);
    expect(finishedProjects(list).map((p) => p.id)).toEqual(['c', 'd']);
  });

  it('allOpenSteps(): open steps with text of counted projects under way, newest first', () => {
    const withBlank = [
      ...list,
      project('g', {
        createdAt: '2026-08-01T00:00:00.000Z',
        steps: [
          { key: 'g-1', text: '  ', done: false },
          { key: 'g-2', text: ' Padded ', done: false },
        ],
      }),
    ];
    expect(allOpenSteps(withBlank)).toEqual([
      { projectId: 'b', key: 'b-2', text: 'Second' },
      { projectId: 'a', key: 'a-2', text: 'Second' },
      { projectId: 'g', key: 'g-2', text: 'Padded' },
    ]);
    expect(allOpenSteps([])).toEqual([]);
  });

  it('counts under way projects on the hub, never samples, deleted or finished ones', () => {
    expect(hubStatus(list)).toEqual({
      key: 'habits.exercises.h2-projects.underWayCount',
      count: 2,
    });
    expect(
      hubStatus([project('c', { status: 'done' }), project('e', { sample: true })]),
    ).toBeNull();
  });

  it('is started once a counted project has a name', () => {
    expect(isStarted([project('e', { sample: true })])).toBe(false);
    expect(isStarted([project('a', { name: ' ' })])).toBe(false);
    expect(isStarted([project('a')])).toBe(true);
  });

  it('summarises counted projects and their steps; null with none', () => {
    expect(summarize(list)).toEqual({ count: 4, done: 1, steps: 8, stepsDone: 4 });
    expect(summarize([project('e', { sample: true })])).toBeNull();
    expect(summarize([project('a', { steps: [] })])).toEqual({
      count: 1,
      done: 0,
      steps: 0,
      stepsDone: 0,
    });
  });
});

describe('the gate', () => {
  const labels = checklistLabelsFrom(['Name', 'Result', 'Step', 'Finished']);

  it('enables Mark done for a counted, Done project with a result and a step', () => {
    expect(isComplete([project('a', { status: 'done' })])).toBe(true);
    expect(isComplete([project('a', { status: 'done', sample: true })])).toBe(false);
    expect(isComplete([project('a', { status: 'done', deletedAt: T0 })])).toBe(false);
    expect(isComplete([project('a')])).toBe(false);
  });

  it('shows the checklist of the project closest to passing', () => {
    const list = [project('a', { desiredResult: undefined, steps: [] }), project('b')];
    expect(doneChecklist(list, labels)).toEqual([
      { label: 'Name', met: true },
      { label: 'Result', met: true },
      { label: 'Step', met: true },
      { label: 'Finished', met: false },
    ]);
    expect(doneChecklist([], labels).every((item) => !item.met)).toBe(true);
  });

  it('waits for the labels to load', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(labels)).toBe(true);
  });
});

describe('rows', () => {
  it('shows progress once there is a step, then the deadline', () => {
    expect(rowSubtitle(project('a', { deadline: '2026-10-12' }), LABELS)).toBe(
      '1 of 2 steps · on 2026-10-12',
    );
    expect(rowSubtitle(project('a', { steps: [] }), LABELS)).toBe('');
    expect(rowSubtitle(project('a', { steps: [], deadline: '2026-10-12' }), LABELS)).toBe(
      'on 2026-10-12',
    );
  });

  it('formats the counts in the numerals it is given', () => {
    const arabic = new Intl.NumberFormat('ar-EG');
    const labels: ProjectLabels = {
      ...LABELS,
      progress: (done, total) => `${arabic.format(done)} من ${arabic.format(total)} خطوات`,
    };
    expect(rowSubtitle(project('a'), labels)).toBe('١ من ٢ خطوات');
  });

  it('marks an overdue row with a hidden prefix; a sample is never overdue or done', () => {
    const overdue = toListItem(project('a', { deadline: '2026-09-01' }), TODAY, LABELS);
    expect(overdue).toMatchObject({ warning: true, warningLabel: 'Overdue:', done: false });
    const sample = toListItem(
      project('b', { deadline: '2026-09-01', status: 'done', sample: true }),
      TODAY,
      LABELS,
    );
    expect(sample.warning).toBeUndefined();
    expect(sample.done).toBe(false);
    expect(sample.chips).toEqual([{ label: 'Example' }]);
    expect(toListItem(project('c', { status: 'done' }), TODAY, LABELS).done).toBe(true);
  });
});

describe('edits', () => {
  it('cleans emptied dates and an emptied desired result to absent, and keeps every criterion', () => {
    expect(editFields({ deadline: '' })).toEqual({ deadline: undefined });
    expect(editFields({ deadline: '2026-02-30' })).toEqual({ deadline: undefined });
    expect(editFields({ deadline: '2026-10-12' })).toEqual({ deadline: '2026-10-12' });
    expect(editFields({ desiredResult: '  ' })).toEqual({ desiredResult: undefined });
    expect(editFields({ criteria: ['1', '2', '3', '4', '5', '6'] }).criteria).toHaveLength(6);
    expect(editFields({ steps: [{ key: 's', text: 'x', done: false, date: '' }] }).steps).toEqual([
      { key: 's', text: 'x', done: false },
    ]);
  });

  it('merges an edit, bumps updatedAt and drops the sample flag; the same array for a no-op', () => {
    const list = [project('a', { sample: true, deadline: '2026-10-12' })];
    const next = editProject(list, 'a', { name: 'Lunch', deadline: '' }, NOW);
    expect(next[0]).toMatchObject({ name: 'Lunch', updatedAt: NOW.toISOString() });
    expect('sample' in next[0]).toBe(false);
    expect('deadline' in next[0]).toBe(false);
    expect(editProject(list, 'a', { name: 'Project a' }, NOW)).toBe(list);
    expect(editProject(list, 'x', { name: 'Nope' }, NOW)).toBe(list);
  });

  it('stores a draft with the same shape as a saved edit: no explicit undefined (#217)', () => {
    const draft = { ...project('d', { deadline: '2026-10-12' }), ...editFields({ deadline: '' }) };
    expect('deadline' in draft).toBe(true);
    const inserted = insertProject([], draft);
    expect('deadline' in inserted[0]).toBe(false);
    const edited = editProject(
      [project('d', { deadline: '2026-10-12' })],
      'd',
      { deadline: '' },
      NOW,
    );
    expect(Object.keys(inserted[0]).sort()).toEqual(Object.keys(edited[0]).sort());
    expect(insertProject(inserted, draft)).toBe(inserted);
  });

  it('deletes softly and restores', () => {
    const list = [project('a')];
    const removed = removeProject(list, 'a', NOW);
    expect(removed[0].deletedAt).toBe(NOW.toISOString());
    expect(removeProject(removed, 'a', NOW)).toBe(removed);
    const restored = restoreProject(removed, 'a', NOW);
    expect('deletedAt' in restored[0]).toBe(false);
    expect(restoreProject(list, 'a', NOW)).toBe(list);
  });
});

describe('samples', () => {
  let n = 0;
  const newKey = () => `k${(n += 1)}`;

  it('builds fields from a guide example, the deadline counted from today', () => {
    const fields = projectFromExample(
      {
        name: 'Lunch',
        desiredResult: 'Everyone there.',
        criteria: ['All came.', ''],
        deadline: true,
        steps: [{ text: 'Ask', done: false }, { text: '' }, { text: 'Book', done: true }],
        status: 'planning',
      },
      TODAY,
      newKey,
    );
    expect(fields).toMatchObject({
      name: 'Lunch',
      desiredResult: 'Everyone there.',
      criteria: ['All came.'],
      deadline: '2026-09-24',
      status: 'planning',
      steps: [
        { text: 'Ask', done: false },
        { text: 'Book', done: true },
      ],
    });
    expect(SAMPLE_DEADLINE_IN_DAYS).toBe(14);
    expect(new Set(fields!.steps.map((step) => step.key)).size).toBe(2);
  });

  it('has no deadline unless the example asks for one, and rejects malformed payloads', () => {
    expect(projectFromExample({ name: 'Talk', status: 'underWay' }, TODAY, newKey)).toEqual({
      name: 'Talk',
      criteria: [],
      steps: [],
      status: 'underWay',
    });
    expect(projectFromExample(null, TODAY, newKey)).toBeNull();
    expect(projectFromExample({ name: '', status: 'planning' }, TODAY, newKey)).toBeNull();
    expect(projectFromExample({ name: 'x', status: 'paused' }, TODAY, newKey)).toBeNull();
  });

  it('finds the live untouched sample of an example by name', () => {
    const list = [project('a', { name: 'Lunch', sample: true }), project('b', { name: 'Talk' })];
    expect(liveSampleOf(list, { name: 'Lunch' })?.id).toBe('a');
    expect(liveSampleOf(list, { name: 'Talk' })).toBeUndefined();
  });
});
