import documentV2Fixture from '../../testing/fixtures/document-v2.json';
import documentV3Fixture from '../../testing/fixtures/document-v3.json';
import { CURRENT_SCHEMA_VERSION } from '../../core/data/document.model';
import { resolveDocument } from '../../core/data/document-validation';
import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  PC_BALANCE_MODEL_KEY,
  PC_BALANCE_PATH,
  PcAudit,
  registerPcBalanceModel,
} from './pc-balance.model';

// Vitest here runs with `isolate: false` (shared module state) — see `backup.model.spec.ts` for
// why this re-asserts the registration instead of resetting it.
beforeEach(() => registerPcBalanceModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === PC_BALANCE_MODEL_KEY);
  if (!found) {
    throw new Error('paradigms-pc-balance model was not registered');
  }
  return found;
}

const FULL_AUDIT: PcAudit = {
  id: 'aud1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  date: '2026-01-01',
  assets: [
    { key: 'k1', name: 'Sleep', group: 'physical', p: 5, pc: 1, action: 'Sleep by 10pm' },
    { key: 'k2', name: 'Savings', group: 'financial', p: 3, pc: 3 },
  ],
  reflection: 'Noticing I burn out on weekdays.',
};

describe('paradigms-pc-balance model', () => {
  it('registers at habits.paradigms.pcAudits', () => {
    expect(registration().path).toBe(PC_BALANCE_PATH);
  });

  it('defaults to an empty array', () => {
    expect(registration().defaults()).toEqual([]);
  });

  it('registers the exercise for the paradigms habit at its route', () => {
    const entry = getRegisteredExercises().find(
      (exercise) => exercise.exerciseId === PC_BALANCE_MODEL_KEY,
    );
    expect(entry).toEqual({
      exerciseId: PC_BALANCE_MODEL_KEY,
      habit: 'paradigms',
      titleKey: 'habits.exercises.paradigms-pc-balance.title',
      shortTitleKey: 'habits.exercises.paradigms-pc-balance.shortTitle',
      icon: 'balance',
      route: 'habits/paradigms/pc-balance',
      // Issue #216: built from this exercise's own pure `isStarted()` predicate.
      // Issue #219: chapter order on the hub, and the status column's in-progress text.
      order: 30,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('validates an empty array', () => {
    expect(registration().validate?.([])).toBe(true);
  });

  it('validates a fully filled audit, including an asset with no action', () => {
    expect(registration().validate?.([FULL_AUDIT])).toBe(true);
  });

  it('rejects an audit missing a required base or domain field', () => {
    const withoutReflection: Record<string, unknown> = { ...FULL_AUDIT };
    delete withoutReflection['reflection'];
    expect(registration().validate?.([withoutReflection])).toBe(false);
  });

  it('rejects an asset with an unknown group or a non-numeric slider value', () => {
    expect(
      registration().validate?.([
        { ...FULL_AUDIT, assets: [{ ...FULL_AUDIT.assets[0], group: 'social' }] },
      ]),
    ).toBe(false);
    expect(
      registration().validate?.([{ ...FULL_AUDIT, assets: [{ ...FULL_AUDIT.assets[0], p: '5' }] }]),
    ).toBe(false);
  });

  it('rejects a non-array value', () => {
    expect(registration().validate?.({})).toBe(false);
  });

  it('passes validateDocument() when the document contains this slice (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { paradigms: { pcAudits: [FULL_AUDIT] } } });
    expect(issues.filter((issue) => issue.path === PC_BALANCE_PATH)).toEqual([]);
  });

  it('loads a v2 document holding a built-in asset: migrated, its key and blank name kept (#223)', () => {
    const v2 = structuredClone(documentV2Fixture) as Record<string, unknown>;
    const pcAudits = structuredClone(documentV3Fixture.habits.paradigms.pcAudits);
    (v2['habits'] as Record<string, Record<string, unknown>>)['paradigms']['pcAudits'] = pcAudits;

    const result = resolveDocument(v2);

    if (!result.ok) {
      throw new Error('the v2 document did not load');
    }
    expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const audits = (result.document.habits['paradigms'] as { pcAudits: PcAudit[] }).pcAudits;
    expect(audits).toEqual(pcAudits);
    expect(audits[0].assets[0]).toMatchObject({ key: 'sleep', name: '' });
  });
});
