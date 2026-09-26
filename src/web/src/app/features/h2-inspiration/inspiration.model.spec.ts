import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import { getMissionInputs } from '../../shared/mission-inputs/mission-inputs';
import {
  INSPIRATION_MODEL_KEY,
  INSPIRATION_PATH,
  INSPIRATION_ROUTE,
  Inspiration,
  registerInspirationModel,
} from './inspiration.model';

// Vitest here runs with `isolate: false` (shared module state): re-assert, don't reset.
beforeEach(() => registerInspirationModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === INSPIRATION_MODEL_KEY);
  if (!found) {
    throw new Error('h2-inspiration model was not registered');
  }
  return found;
}

const FULL_ITEM: Inspiration = {
  id: 'i1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  text: 'Nobody on their deathbed wished they had answered more email.',
  kind: 'saying',
  source: 'My uncle',
  tags: ['time', 'work'],
  favourite: true,
  sample: false,
};

describe('h2-inspiration model', () => {
  it('registers at habits.h2.inspirations with an empty default', () => {
    expect(registration().path).toBe(INSPIRATION_PATH);
    expect(INSPIRATION_PATH).toBe('habits.h2.inspirations');
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise fourth on the Habit 2 hub with its short title', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === INSPIRATION_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: 'h2-inspiration',
      habit: 'h2',
      titleKey: 'habits.exercises.h2-inspiration.title',
      shortTitleKey: 'habits.exercises.h2-inspiration.shortTitle',
      icon: 'format_quote',
      route: INSPIRATION_ROUTE,
      order: 40,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
    expect(INSPIRATION_ROUTE).toBe('habits/h2/inspiration');
  });

  it('registers the collection as the inspiration mission input (issue #61 contract)', () => {
    const inputs = getMissionInputs('inspiration').filter(
      (entry) => entry.sourceExerciseId === INSPIRATION_MODEL_KEY,
    );
    expect(inputs.length).toBe(1);
  });

  it('validates an empty array, a fully filled item and a minimal one', () => {
    expect(registration().validate?.([])).toBe(true);
    expect(registration().validate?.([FULL_ITEM])).toBe(true);
    const minimal: Record<string, unknown> = { ...FULL_ITEM, tags: [] };
    delete minimal['source'];
    delete minimal['favourite'];
    delete minimal['sample'];
    expect(registration().validate?.([minimal])).toBe(true);
  });

  it('rejects an unknown kind, missing tags, a non-string tag and malformed optional fields', () => {
    expect(registration().validate?.([{ ...FULL_ITEM, kind: 'quote' }])).toBe(false);
    const withoutTags: Record<string, unknown> = { ...FULL_ITEM };
    delete withoutTags['tags'];
    expect(registration().validate?.([withoutTags])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, tags: ['time', 3] }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, tags: 'time' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, source: 7 }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, favourite: 'yes' }])).toBe(false);
    expect(registration().validate?.([{ ...FULL_ITEM, text: null }])).toBe(false);
    expect(registration().validate?.({})).toBe(false);
  });

  it("accepts un-normalised tags: normalising is the readers' rule, not a structure check", () => {
    expect(registration().validate?.([{ ...FULL_ITEM, tags: [' Time ', 'time', ''] }])).toBe(true);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h2: { inspirations: [FULL_ITEM] } } });
    expect(issues.filter((issue) => issue.path === INSPIRATION_PATH)).toEqual([]);
  });
});
