import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { getRegisteredHubActions } from '../../shared/exercise-kit/hub-action-registry';
import { registerTeachModel, TeachEntry, TEACH_MODEL_KEY, TEACH_PATH } from './teach.model';

// Vitest here runs with `isolate: false` (shared module state) — see `transition.model.spec.ts`
// for why this re-asserts the registration instead of resetting it.
beforeEach(() => registerTeachModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === TEACH_MODEL_KEY);
  if (!found) {
    throw new Error('paradigms-teach model was not registered');
  }
  return found;
}

const FULL_ENTRY: TeachEntry = {
  id: 'e1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  chapter: 'h1',
  keyIdea: 'You choose your response, not just react to what happens to you',
  person: 'A colleague',
  plannedAt: '2026-01-03',
  sharedAt: '2026-01-02',
  status: 'shared',
  learned: 'They pushed back on one example, which sharpened it',
};

describe('paradigms-teach model', () => {
  it('registers at habits.paradigms.teach', () => {
    expect(registration().path).toBe(TEACH_PATH);
  });

  it('defaults to an empty array', () => {
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise for the paradigms habit at its route, with a status factory', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === TEACH_MODEL_KEY,
    );
    expect(entry).toMatchObject({
      exerciseId: TEACH_MODEL_KEY,
      habit: 'paradigms',
      titleKey: 'habits.exercises.paradigms-teach.title',
      summaryKey: 'habits.exercises.paradigms-teach.summary',
      icon: 'campaign',
      route: 'habits/paradigms/teach',
    });
    expect(entry?.statusFactory).toBeInstanceOf(Function);
  });

  it('registers a "teach this" hub action that pre-selects the current hub\'s chapter', () => {
    const action = getRegisteredHubActions().find((entry) => entry.id === TEACH_MODEL_KEY);
    expect(action).toMatchObject({
      labelKey: 'habits.exercises.paradigms-teach.hubActionLabel',
      icon: 'campaign',
      route: 'habits/paradigms/teach',
    });
    expect(action?.queryParams?.('h4')).toEqual({ chapter: 'h4' });
  });

  it('validates an empty array', () => {
    expect(registration().validate?.([])).toBe(true);
  });

  it('validates a fully filled entry, including one with no optional fields set', () => {
    expect(registration().validate?.([FULL_ENTRY])).toBe(true);
    const bare: TeachEntry = {
      ...FULL_ENTRY,
      person: undefined,
      sharedAt: undefined,
      learned: undefined,
      status: 'planned',
    };
    expect(registration().validate?.([bare])).toBe(true);
  });

  it('rejects an entry missing a required base or domain field', () => {
    const withoutKeyIdea: Record<string, unknown> = { ...FULL_ENTRY };
    delete withoutKeyIdea['keyIdea'];
    expect(registration().validate?.([withoutKeyIdea])).toBe(false);
  });

  it('rejects an entry with an unknown chapter or status', () => {
    expect(registration().validate?.([{ ...FULL_ENTRY, chapter: 'h99' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ENTRY, status: 'ignored' }])).toBe(false);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { paradigms: { teach: [FULL_ENTRY] } } });
    expect(issues.filter((issue) => issue.path === TEACH_PATH)).toEqual([]);
  });
});
