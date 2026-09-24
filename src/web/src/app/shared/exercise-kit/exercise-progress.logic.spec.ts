import { ExerciseCompletion } from './exercise-kit.model';
import { ExerciseRegistryEntry } from './exercise-registry';
import {
  completedAtFor,
  hasAnyCompletion,
  isExerciseDone,
  progressForHabit,
  reopenCompletion,
  upsertDoneCompletion,
} from './exercise-progress.logic';
import { nextExercise } from './exercise-progress.logic';

const NOW = new Date('2026-01-02T10:00:00.000Z');
const LATER = new Date('2026-01-03T10:00:00.000Z');

describe('hasAnyCompletion (#220)', () => {
  it('is false with no completion records', () => {
    expect(hasAnyCompletion([])).toBe(false);
  });

  it('stays true after the only done exercise is reopened', () => {
    const done = upsertDoneCompletion([], 'h2-mission', NOW);

    expect(hasAnyCompletion(reopenCompletion(done, 'h2-mission', LATER))).toBe(true);
  });

  it('ignores tombstoned records', () => {
    const [completion] = upsertDoneCompletion([], 'h2-mission', NOW);

    expect(hasAnyCompletion([{ ...completion, deletedAt: LATER.toISOString() }])).toBe(false);
  });
});

describe('upsertDoneCompletion', () => {
  it('creates a completion the first time an exercise is marked done', () => {
    const completions = upsertDoneCompletion([], 'h2-mission', NOW);

    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      exerciseId: 'h2-mission',
      completedAt: NOW.toISOString(),
    });
    expect(completions[0].id).toBeTruthy();
  });

  it('updates the existing completion instead of adding another one', () => {
    const first = upsertDoneCompletion([], 'h2-mission', NOW);

    const second = upsertDoneCompletion(first, 'h2-mission', LATER);

    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].completedAt).toBe(LATER.toISOString());
  });

  it('leaves other exercises untouched', () => {
    const completions = upsertDoneCompletion(
      upsertDoneCompletion([], 'h1-proactive', NOW),
      'h2-mission',
      LATER,
    );

    expect(completions.map((c) => c.exerciseId).sort()).toEqual(['h1-proactive', 'h2-mission']);
  });
});

describe('reopenCompletion', () => {
  it('stamps reopenedAt on the existing completion', () => {
    const done = upsertDoneCompletion([], 'h2-mission', NOW);

    const reopened = reopenCompletion(done, 'h2-mission', LATER);

    expect(reopened[0].reopenedAt).toBe(LATER.toISOString());
  });

  it('is a no-op for an exercise that was never marked done', () => {
    expect(reopenCompletion([], 'h2-mission', NOW)).toEqual([]);
  });
});

describe('isExerciseDone / completedAtFor', () => {
  it('is false for an exercise with no completion', () => {
    expect(isExerciseDone([], 'h2-mission')).toBe(false);
    expect(completedAtFor([], 'h2-mission')).toBeNull();
  });

  it('is true once marked done', () => {
    const completions = upsertDoneCompletion([], 'h2-mission', NOW);

    expect(isExerciseDone(completions, 'h2-mission')).toBe(true);
    expect(completedAtFor(completions, 'h2-mission')).toBe(NOW.toISOString());
  });

  it('is false again after being reopened', () => {
    const completions = reopenCompletion(
      upsertDoneCompletion([], 'h2-mission', NOW),
      'h2-mission',
      LATER,
    );

    expect(isExerciseDone(completions, 'h2-mission')).toBe(false);
    expect(completedAtFor(completions, 'h2-mission')).toBeNull();
  });

  it('is true again after being marked done a second time', () => {
    const reopened = reopenCompletion(
      upsertDoneCompletion([], 'h2-mission', NOW),
      'h2-mission',
      LATER,
    );
    const redone = upsertDoneCompletion(
      reopened,
      'h2-mission',
      new Date('2026-01-04T10:00:00.000Z'),
    );

    expect(isExerciseDone(redone, 'h2-mission')).toBe(true);
  });

  it('is true again after being marked done a second time in the same instant as the reopen', () => {
    const redone = upsertDoneCompletion(
      reopenCompletion(upsertDoneCompletion([], 'h2-mission', NOW), 'h2-mission', NOW),
      'h2-mission',
      NOW,
    );

    expect(isExerciseDone(redone, 'h2-mission')).toBe(true);
  });

  it('is false after being reopened in the same instant as it was marked done', () => {
    const reopened = reopenCompletion(
      upsertDoneCompletion([], 'h2-mission', NOW),
      'h2-mission',
      NOW,
    );

    expect(isExerciseDone(reopened, 'h2-mission')).toBe(false);
  });
});

describe('progressForHabit', () => {
  const registry: ExerciseRegistryEntry[] = [
    {
      exerciseId: 'h2-mission',
      habit: 'h2',
      titleKey: 'mission.title',
      shortTitleKey: 'mission.shortTitle',
      icon: 'flag',
      route: 'habits/h2/mission',
    },
    {
      exerciseId: 'h2-roles',
      habit: 'h2',
      titleKey: 'roles.title',
      shortTitleKey: 'roles.shortTitle',
      icon: 'flag',
      route: 'habits/h2/roles',
    },
    {
      exerciseId: 'h1-proactive',
      habit: 'h1',
      titleKey: 'proactive.title',
      shortTitleKey: 'proactive.shortTitle',
      icon: 'flag',
      route: 'habits/h1/proactive',
    },
  ];

  it('counts done/total for exercises registered to the habit only', () => {
    const completions: ExerciseCompletion[] = upsertDoneCompletion([], 'h2-mission', NOW);

    expect(progressForHabit(completions, registry, 'h2')).toEqual({ done: 1, total: 2 });
    expect(progressForHabit(completions, registry, 'h1')).toEqual({ done: 0, total: 1 });
  });

  it('is 0/0 for a habit with no registered exercises', () => {
    expect(progressForHabit([], registry, 'h3')).toEqual({ done: 0, total: 0 });
  });
});

describe('nextExercise (#219)', () => {
  function entry(exerciseId: string, order?: number): ExerciseRegistryEntry {
    return {
      exerciseId,
      habit: 'h2',
      titleKey: `${exerciseId}.title`,
      shortTitleKey: `${exerciseId}.shortTitle`,
      icon: 'flag',
      route: `habits/h2/${exerciseId}`,
      ...(order === undefined ? {} : { order }),
    };
  }

  it('is undefined when nothing is given', () => {
    expect(nextExercise([], () => false)).toBeUndefined();
  });

  it('is the first exercise in chapter order that is not done, whatever the registration order', () => {
    const exercises = [entry('roles', 20), entry('mission', 10), entry('goals', 30)];
    expect(nextExercise(exercises, () => false)?.exerciseId).toBe('mission');
    expect(nextExercise(exercises, (id) => id === 'mission')?.exerciseId).toBe('roles');
  });

  it('falls back to registration order for entries without an order', () => {
    const exercises = [entry('mission'), entry('roles')];
    expect(nextExercise(exercises, (id) => id === 'mission')?.shortTitleKey).toBe(
      'roles.shortTitle',
    );
  });

  it('is undefined once every exercise is done', () => {
    expect(nextExercise([entry('mission'), entry('roles')], () => true)).toBeUndefined();
  });
});
