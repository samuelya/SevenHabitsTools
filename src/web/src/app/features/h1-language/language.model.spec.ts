import { getRegisteredModels, validateDocument } from '../../core/data/registry';
import { getRegisteredExercises } from '../../shared/exercise-kit/exercise-registry';
import {
  LANGUAGE_MODEL_KEY,
  LANGUAGE_PATH,
  LanguageLog,
  ListeningDay,
  Phrase,
  registerLanguageModel,
} from './language.model';

// Vitest runs with `isolate: false`: re-assert the registration instead of resetting it.
beforeEach(() => registerLanguageModel());

function registration() {
  const found = getRegisteredModels().find((model) => model.key === LANGUAGE_MODEL_KEY);
  if (!found) {
    throw new Error('h1-language model was not registered');
  }
  return found;
}

const STAMP = '2026-01-01T00:00:00.000Z';

const FULL_PHRASE: Phrase = {
  id: 'p1',
  createdAt: STAMP,
  updatedAt: STAMP,
  text: 'I have to stay late again.',
  kind: 'reactive',
  reframe: "I'll stay till six.",
  context: 'Team call',
  listeningDayId: 'd1',
  sample: false,
};

const DAY: ListeningDay = {
  id: 'd1',
  createdAt: STAMP,
  updatedAt: STAMP,
  startedAt: STAMP,
  endedAt: '2026-01-01T10:00:00.000Z',
};

const FULL_LOG: LanguageLog = { phrases: [FULL_PHRASE], listeningDays: [DAY] };

describe('h1-language model', () => {
  it('registers at habits.h1.language with two empty arrays by default', () => {
    expect(registration().path).toBe(LANGUAGE_PATH);
    expect(registration().defaults()).toEqual({ phrases: [], listeningDays: [] });
  });

  it('registers the exercise first on the Habit 1 hub (order 10)', () => {
    const entry = getRegisteredExercises().find((e) => e.exerciseId === LANGUAGE_MODEL_KEY);
    expect(entry).toEqual({
      exerciseId: LANGUAGE_MODEL_KEY,
      habit: 'h1',
      titleKey: 'habits.exercises.h1-language.title',
      shortTitleKey: 'habits.exercises.h1-language.shortTitle',
      icon: 'record_voice_over',
      route: 'habits/h1/language',
      order: 10,
      statusFactory: expect.any(Function),
      isStarted: expect.any(Function),
    });
  });

  it('validates the defaults, a full log and a minimal phrase and day', () => {
    const minimalPhrase: Phrase = {
      id: 'p2',
      createdAt: STAMP,
      updatedAt: STAMP,
      text: '',
      kind: 'proactive',
    };
    const runningDay: ListeningDay = {
      id: 'd2',
      createdAt: STAMP,
      updatedAt: STAMP,
      startedAt: STAMP,
    };
    expect(registration().validate?.(registration().defaults())).toBe(true);
    expect(registration().validate?.(FULL_LOG)).toBe(true);
    expect(
      registration().validate?.({ phrases: [minimalPhrase], listeningDays: [runningDay] }),
    ).toBe(true);
  });

  it('accepts a phrase whose listening day no longer exists (structure only)', () => {
    expect(registration().validate?.({ phrases: [FULL_PHRASE], listeningDays: [] })).toBe(true);
  });

  it('rejects a wrong kind, a missing text and wrong field types', () => {
    const withoutText: Record<string, unknown> = { ...FULL_PHRASE };
    delete withoutText['text'];
    const log = (phrase: unknown) => ({ phrases: [phrase], listeningDays: [] });
    expect(registration().validate?.(log(withoutText))).toBe(false);
    expect(registration().validate?.(log({ ...FULL_PHRASE, kind: 'neutral' }))).toBe(false);
    expect(registration().validate?.(log({ ...FULL_PHRASE, reframe: 3 }))).toBe(false);
    expect(registration().validate?.(log({ ...FULL_PHRASE, listeningDayId: 1 }))).toBe(false);
    expect(registration().validate?.(log({ ...FULL_PHRASE, sample: 'yes' }))).toBe(false);
  });

  it('rejects a day without startedAt or with a non-string endedAt', () => {
    const day = (value: unknown) => ({ phrases: [], listeningDays: [value] });
    const withoutStart: Record<string, unknown> = { ...DAY };
    delete withoutStart['startedAt'];
    expect(registration().validate?.(day(withoutStart))).toBe(false);
    expect(registration().validate?.(day({ ...DAY, endedAt: 5 }))).toBe(false);
  });

  it('rejects an array, a missing array and null', () => {
    expect(registration().validate?.([])).toBe(false);
    expect(registration().validate?.({ phrases: [] })).toBe(false);
    expect(registration().validate?.(null)).toBe(false);
  });

  it('passes validateDocument() with the slice present (export/import guarantee)', () => {
    const issues = validateDocument({ habits: { h1: { language: FULL_LOG } } });
    expect(issues.filter((issue) => issue.path === LANGUAGE_PATH)).toEqual([]);
  });
});
