import documentV1Fixture from '../../testing/fixtures/document-v1.json';
import documentV2Fixture from '../../testing/fixtures/document-v2.json';
import { resolveDocument } from '../../core/data/document-validation';
import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  MATURITY_MODEL_KEY,
  MATURITY_PATH,
  MaturityAssessment,
  registerMaturityModel,
} from './maturity.model';

// Vitest here runs with `isolate: false` (shared module state) — see `backup.model.spec.ts` for
// why this re-asserts the registration instead of resetting it.
beforeEach(() => registerMaturityModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === MATURITY_MODEL_KEY);
  if (!found) {
    throw new Error('paradigms-maturity model was not registered');
  }
  return found;
}

const FULL_ASSESSMENT: MaturityAssessment = {
  id: 'as1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  date: '2026-01-01',
  areas: [
    { id: 'ar1', key: 'work', level: 2 },
    { id: 'ar2', name: 'Volunteering', level: 1, note: 'Just starting out' },
    { id: 'ar3', key: 'family', name: 'My household', level: 3 },
  ],
};

describe('paradigms-maturity model', () => {
  it('registers at habits.paradigms.maturity', () => {
    expect(registration().path).toBe(MATURITY_PATH);
  });

  it('accepts the new friendships key and the no-longer-suggested community key (#222)', () => {
    const areas = [
      { id: 'k1', key: 'friendships', level: 2 },
      { id: 'k2', key: 'community', level: 1 },
    ];
    expect(registration().validate?.([{ ...FULL_ASSESSMENT, areas }])).toBe(true);
  });

  it('defaults to an empty array', () => {
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise for the paradigms habit at its route', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === MATURITY_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: MATURITY_MODEL_KEY,
      habit: 'paradigms',
      titleKey: 'habits.exercises.paradigms-maturity.title',
      shortTitleKey: 'habits.exercises.paradigms-maturity.shortTitle',
      icon: 'stairs',
      route: 'habits/paradigms/maturity',
      // Issue #216: built from this exercise's own pure `isStarted()` predicate.
      // Issue #219: chapter order on the hub, and the status column's in-progress text.
      order: 40,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('validates an empty array', () => {
    expect(registration().validate?.([])).toBe(true);
  });

  it('validates a fully filled assessment, including areas with no level yet', () => {
    expect(registration().validate?.([FULL_ASSESSMENT])).toBe(true);
    const unrated = {
      ...FULL_ASSESSMENT,
      areas: FULL_ASSESSMENT.areas.map((area) => ({ ...area, level: undefined })),
    };
    expect(registration().validate?.([unrated])).toBe(true);
  });

  it('rejects an assessment missing a required base or domain field', () => {
    const withoutDate: Record<string, unknown> = { ...FULL_ASSESSMENT };
    delete withoutDate['date'];
    expect(registration().validate?.([withoutDate])).toBe(false);
  });

  it('rejects an area with an unknown key or a non-numeric level', () => {
    expect(
      registration().validate?.([{ ...FULL_ASSESSMENT, areas: [{ id: 'ar1', key: 'hobbies' }] }]),
    ).toBe(false);
    expect(
      registration().validate?.([{ ...FULL_ASSESSMENT, areas: [{ id: 'ar1', level: '2' }] }]),
    ).toBe(false);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { paradigms: { maturity: [FULL_ASSESSMENT] } } });
    expect(issues.filter((issue) => issue.path === MATURITY_PATH)).toEqual([]);
  });

  it('loads the v2 fixture, whose assessment holds a friendships area (#222 re-review R7)', () => {
    const result = resolveDocument(structuredClone(documentV2Fixture));

    if (!result.ok) {
      throw new Error('the v2 fixture did not load');
    }
    const maturity = (result.document.habits['paradigms'] as { maturity: MaturityAssessment[] })
      .maturity;
    expect(maturity[0].areas.map((area) => area.key)).toEqual(['friendships', 'community']);
  });

  it('loads a v1 document holding assessments: migrated to v2, every area unchanged (#222)', () => {
    const v1 = structuredClone(documentV1Fixture) as Record<string, unknown>;
    const legacy = {
      ...FULL_ASSESSMENT,
      areas: [...FULL_ASSESSMENT.areas, { id: 'ar4', key: 'community', level: 2 }],
    };
    (v1['habits'] as Record<string, Record<string, unknown>>)['paradigms'] = { maturity: [legacy] };

    const result = resolveDocument(v1);

    if (!result.ok) {
      throw new Error('the v1 document did not load');
    }
    expect(result.document.schemaVersion).toBe(2);
    expect(result.document.habits).toEqual(v1['habits']);
  });
});
