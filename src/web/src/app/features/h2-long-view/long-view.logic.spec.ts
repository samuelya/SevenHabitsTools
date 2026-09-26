import {
  CHECKLIST_KEYS,
  PROMPTS,
  addValue,
  canMarkDone,
  checklistLabelsFrom,
  checklistLoaded,
  completedScenarios,
  doneChecklist,
  editLongView,
  historyItems,
  hubStatus,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  labelsByKey,
  newLongViewFields,
  removeLongView,
  removeValue,
  restoreLongView,
  scenarioValues,
  speakerSlot,
  valuesHeard,
  withAnswer,
} from './long-view.logic';
import { LongView, LongViewAnswer, LongViewScenario } from './long-view.model';

const T0 = '2026-09-01T00:00:00.000Z';
const LATER = new Date('2026-09-02T10:00:00.000Z');

function view(
  scenario: LongViewScenario,
  fill: (answer: LongViewAnswer, index: number) => Partial<LongViewAnswer> = () => ({}),
  overrides: Partial<LongView> = {},
): LongView {
  const fields = newLongViewFields(scenario, '2026-09-01');
  return {
    id: `${scenario}-${Math.random()}`,
    createdAt: T0,
    updatedAt: T0,
    ...fields,
    answers: fields.answers.map((answer, index) => ({ ...answer, ...fill(answer, index) })),
    ...overrides,
  };
}

const complete = (scenario: LongViewScenario, values: string[] = ['family']): LongView =>
  view(scenario, (_answer, index) => ({ text: 'Something.', values: index === 0 ? values : [] }));

const LABELS = checklistLabelsFrom(['Pick', 'Answer', 'Value']);

describe('long view logic (issue #58)', () => {
  it('builds one empty answer per prompt, in prompt order', () => {
    const fields = newLongViewFields('oneYear', '2026-09-01');
    expect(fields.answers.map((answer) => answer.promptKey)).toEqual(PROMPTS.oneYear);
    expect(fields.answers.every((answer) => answer.text === '' && answer.values.length === 0)).toBe(
      true,
    );
  });

  it('names a speaker slot only for funeral prompts', () => {
    expect(speakerSlot('funeral.friend')).toBe('friend');
    expect(speakerSlot('oneYear.who')).toBeNull();
  });

  it('adds a trimmed, non-empty value once, case-insensitively, and removes it', () => {
    expect(addValue(['Family'], '  time ')).toEqual(['Family', 'time']);
    const values = ['Family'];
    expect(addValue(values, ' family')).toBe(values);
    expect(addValue(values, '   ')).toBe(values);
    expect(removeValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('replaces one answer and keeps prompt order, even for a record missing answers', () => {
    const partial = view('funeral', () => ({}), {
      answers: [{ promptKey: 'funeral.work', text: 'w', values: [] }],
    });
    const answers = withAnswer(partial, 'funeral.friend', { speaker: 'Sam' });
    expect(answers.map((answer) => answer.promptKey)).toEqual(PROMPTS.funeral);
    expect(answers[1].speaker).toBe('Sam');
    expect(answers[2].text).toBe('w');
  });

  it('is worth saving on typed text, a speaker edit or a chip — not on the scenario alone', () => {
    expect(isDraftWorthSaving(view('funeral'))).toBe(false);
    expect(isDraftWorthSaving(view('funeral', () => ({ text: '   ' })))).toBe(false);
    expect(isDraftWorthSaving(view('funeral', (_a, i) => (i === 0 ? { text: 'x' } : {})))).toBe(
      true,
    );
    expect(isDraftWorthSaving(view('funeral', (_a, i) => (i === 1 ? { speaker: '' } : {})))).toBe(
      true,
    );
    expect(isDraftWorthSaving(view('lastDay', (_a, i) => (i === 1 ? { values: ['x'] } : {})))).toBe(
      true,
    );
  });

  it('is complete when every prompt has text and one value exists across the scenario', () => {
    expect(isComplete(complete('anniversary'))).toBe(true);
    expect(isComplete(complete('anniversary', []))).toBe(false);
    const oneEmpty = view('lastDay', (_a, i) => ({ text: i === 0 ? 'x' : ' ', values: ['v'] }));
    expect(isComplete(oneEmpty)).toBe(false);
  });

  it('gates Mark done and the checklist on the live long view closest to passing', () => {
    expect(canMarkDone([])).toBe(false);
    expect(doneChecklist([], LABELS).map((item) => item.met)).toEqual([false, false, false]);

    const answered = view('oneYear', () => ({ text: 'x' }));
    expect(doneChecklist([answered], LABELS).map((item) => item.met)).toEqual([true, true, false]);
    expect(canMarkDone([answered])).toBe(false);

    const deleted = { ...complete('funeral'), deletedAt: T0 };
    expect(canMarkDone([answered, deleted])).toBe(false);
    expect(canMarkDone([answered, complete('funeral')])).toBe(true);
  });

  it('gates the checklist on loaded labels', () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(LABELS)).toBe(true);
    expect(CHECKLIST_KEYS).toEqual(['scenario', 'answers', 'value']);
  });

  it('collects one scenario’s values without duplicates', () => {
    const lv = view('funeral', (_a, i) => ({ values: i === 0 ? ['Family', 'time'] : ['family'] }));
    expect(scenarioValues(lv)).toEqual(['Family', 'time']);
  });

  it('counts values heard across live views, first spelling kept, most heard first', () => {
    const list = [
      complete('funeral', ['Family', 'time']),
      complete('oneYear', ['family ', 'memory']),
      complete('lastDay', ['FAMILY', 'Time']),
      { ...complete('anniversary', ['ghost']), deletedAt: T0 },
    ];
    expect(valuesHeard(list)).toEqual([
      { value: 'Family', count: 3 },
      { value: 'time', count: 2 },
      { value: 'memory', count: 1 },
    ]);
    expect(valuesHeard([])).toEqual([]);
  });

  it('counts distinct scenarios with a complete live record for the hub', () => {
    expect(hubStatus([view('funeral')])).toBeNull();
    const list = [complete('funeral'), complete('funeral'), complete('oneYear'), view('lastDay')];
    expect(completedScenarios(list)).toEqual(['funeral', 'oneYear']);
    expect(hubStatus(list)).toEqual({
      key: 'habits.exercises.h2-long-view.scenarioCount',
      count: 2,
    });
  });

  it('is started by any live record', () => {
    expect(isStarted([])).toBe(false);
    expect(isStarted([{ ...view('funeral'), deletedAt: T0 }])).toBe(false);
    expect(isStarted([view('funeral')])).toBe(true);
  });

  it('builds history rows titled by scenario with a value count', () => {
    const lv = complete('oneYear', ['a', 'b']);
    const labels = labelsByKey(['funeral', 'oneYear', 'anniversary', 'lastDay'] as const, [
      'F',
      'One year left',
    ]);
    expect(historyItems([lv], labels)).toEqual([
      {
        id: lv.id,
        date: '2026-09-01',
        label: 'One year left',
        summary: { key: 'h2LongView.list.valueCountText', count: 2 },
      },
    ]);
    expect(labels.lastDay).toBe('');
  });

  it('edits, tombstones and restores a record, bumping updatedAt', () => {
    const lv = view('funeral');
    const [edited] = editLongView([lv], lv.id, { reflection: 'r' }, LATER);
    expect(edited.reflection).toBe('r');
    expect(edited.updatedAt).toBe(LATER.toISOString());

    const [removed] = removeLongView([lv], lv.id, LATER);
    expect(removed.deletedAt).toBe(LATER.toISOString());
    expect(
      editLongView([removed], lv.id, { reflection: 'x' }, LATER)[0].reflection,
    ).toBeUndefined();

    const [restored] = restoreLongView([removed], lv.id, LATER);
    expect(restored.deletedAt).toBeUndefined();
  });
});
