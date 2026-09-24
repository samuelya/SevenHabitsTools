import { MaturityArea, MaturityAssessment } from './maturity.model';
import {
  addArea,
  addAssessment,
  checklistLabelsFrom,
  checklistLoaded,
  deltaFor,
  doneChecklist,
  displayName,
  editAssessment,
  isAssessmentComplete,
  isComplete,
  newAssessmentFields,
  overallProfile,
  removeArea,
  removeAssessment,
  removedAreas,
  renameArea,
  restoreAssessment,
  setAreaLevel,
  setAreaNote,
  suggestedHabits,
  summarize,
  isStarted,
} from './maturity.logic';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function area(overrides: Partial<MaturityArea> = {}): MaturityArea {
  return { id: 'ar1', key: 'work', ...overrides };
}

function assessment(overrides: Partial<MaturityAssessment> = {}): MaturityAssessment {
  return {
    id: 'a1',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    date: '2026-01-01',
    areas: [],
    ...overrides,
  };
}

describe('isAssessmentComplete/isComplete', () => {
  it('is false with no areas', () => {
    expect(isAssessmentComplete(assessment({ areas: [] }))).toBe(false);
  });

  it('is false while any area is unrated', () => {
    const areas = [area({ id: 'a1', level: 1 }), area({ id: 'a2', key: 'family' })];
    expect(isAssessmentComplete(assessment({ areas }))).toBe(false);
  });

  it('is true once every area has a level', () => {
    const areas = [area({ id: 'a1', level: 1 }), area({ id: 'a2', key: 'family', level: 2 })];
    expect(isAssessmentComplete(assessment({ areas }))).toBe(true);
  });

  it('isComplete ignores a tombstoned assessment', () => {
    const complete = assessment({
      areas: [area({ level: 1 })],
      deletedAt: NOW.toISOString(),
    });
    expect(isComplete([complete])).toBe(false);
  });

  it('isComplete is true once at least one live assessment is fully rated', () => {
    const incomplete = assessment({ id: 'a1', areas: [] });
    const complete = assessment({ id: 'a2', areas: [area({ level: 3 })] });
    expect(isComplete([incomplete, complete])).toBe(true);
  });
});

const LABELS = checklistLabelsFrom(['Rate every area']);

describe('doneChecklist', () => {
  it('is one unmet item with no assessments', () => {
    expect(doneChecklist([], LABELS)).toEqual([{ label: 'Rate every area', met: false }]);
  });

  it('stays unmet while any area of the closest assessment is unrated', () => {
    const areas = [area({ id: 'a1', level: 1 }), area({ id: 'a2', key: 'family' })];
    expect(doneChecklist([assessment({ areas })], LABELS)[0].met).toBe(false);
  });

  it('is all met exactly when isComplete is true', () => {
    const cases: MaturityAssessment[][] = [
      [],
      [assessment({ areas: [] })],
      [assessment({ areas: [area({ level: 2 })] })],
      [assessment({ areas: [area({ level: 2 })], deletedAt: NOW.toISOString() })],
    ];
    for (const assessments of cases) {
      expect(doneChecklist(assessments, LABELS).every((item) => item.met)).toBe(
        isComplete(assessments),
      );
    }
  });

  it("checklistLoaded is false for translateSignal's before-load [''] only", () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(LABELS)).toBe(true);
  });
});

describe('displayName', () => {
  const labels = { work: 'Work', family: 'Family' };

  it('is the translated built-in label when no custom name is set', () => {
    expect(displayName(area({ key: 'work', name: undefined }), labels)).toBe('Work');
  });

  it('is the custom name when set, even for a renamed built-in area', () => {
    expect(displayName(area({ key: 'work', name: 'Day job' }), labels)).toBe('Day job');
  });

  it('is the custom name alone for an area with no key', () => {
    expect(displayName(area({ key: undefined, name: 'Volunteering' }), labels)).toBe(
      'Volunteering',
    );
  });
});

describe('overallProfile', () => {
  it('is null with no rated areas', () => {
    expect(overallProfile([area({ level: undefined })])).toBeNull();
  });

  it('is the level held by the most areas', () => {
    const areas = [
      area({ id: 'a1', level: 1 }),
      area({ id: 'a2', level: 1 }),
      area({ id: 'a3', level: 2 }),
    ];
    expect(overallProfile(areas)).toBe(1);
  });

  it('breaks a tie in favour of the lower level', () => {
    const areas = [area({ id: 'a1', level: 2 }), area({ id: 'a2', level: 1 })];
    expect(overallProfile(areas)).toBe(1);
  });

  it('ignores unrated areas', () => {
    const areas = [area({ id: 'a1', level: 3 }), area({ id: 'a2', level: undefined })];
    expect(overallProfile(areas)).toBe(3);
  });
});

describe('suggestedHabits', () => {
  it('maps each profile to its habits, empty with no profile', () => {
    expect(suggestedHabits(1)).toEqual(['h1', 'h2', 'h3']);
    expect(suggestedHabits(2)).toEqual(['h4', 'h5', 'h6']);
    expect(suggestedHabits(3)).toEqual(['h7']);
    expect(suggestedHabits(null)).toEqual([]);
  });
});

describe('deltaFor/removedAreas', () => {
  it('is null with no previous assessment', () => {
    expect(deltaFor(area({ level: 2 }), null)).toBeNull();
  });

  it('is "new" when the area has no match in the previous assessment', () => {
    const previous = [area({ id: 'p1', key: 'family', level: 1 })];
    expect(deltaFor(area({ id: 'c1', key: 'work', level: 2 }), previous)).toEqual({ kind: 'new' });
  });

  it('matches by key first, falling back to name for a custom area', () => {
    const previous = [area({ id: 'p1', key: 'work', level: 1 })];
    expect(deltaFor(area({ id: 'c1', key: 'work', level: 3 }), previous)).toEqual({
      kind: 'diff',
      value: 2,
    });

    const previousCustom = [area({ id: 'p1', key: undefined, name: 'Volunteering', level: 2 })];
    expect(
      deltaFor(area({ id: 'c1', key: undefined, name: 'Volunteering', level: 1 }), previousCustom),
    ).toEqual({ kind: 'diff', value: -1 });
  });

  it('is null when either side is unrated', () => {
    const previous = [area({ id: 'p1', key: 'work', level: undefined })];
    expect(deltaFor(area({ id: 'c1', key: 'work', level: 2 }), previous)).toBeNull();
  });

  it('removedAreas lists previous areas with no match in current', () => {
    const previous = [
      area({ id: 'p1', key: 'work', level: 1 }),
      area({ id: 'p2', key: 'family', level: 2 }),
    ];
    const current = [area({ id: 'c1', key: 'work', level: 2 })];
    expect(removedAreas(current, previous)).toEqual([previous[1]]);
  });

  it('removedAreas is empty with no previous assessment', () => {
    expect(removedAreas([], null)).toEqual([]);
  });

  it('agree with each other when one side has a key and the other only a same-text name', () => {
    // A renamed built-in area (`key` + `name`) must not match a *custom* area that happens to
    // share the same name text (no `key`) — `matches()` used to check only its first argument's
    // `key`, so `deltaFor` (previous, current) and `removedAreas` (current, previous) — opposite
    // argument order — could disagree about this very pair (review finding on #49/#50's PR).
    const previousBuiltIn = area({ id: 'p1', key: 'work', name: 'Volunteering', level: 1 });
    const currentCustom = area({ id: 'c1', key: undefined, name: 'Volunteering', level: 2 });

    expect(deltaFor(currentCustom, [previousBuiltIn])).toEqual({ kind: 'new' });
    expect(removedAreas([currentCustom], [previousBuiltIn])).toEqual([previousBuiltIn]);
  });
});

describe('summarize', () => {
  it('counts only live assessments and reports the latest profile', () => {
    const older = assessment({ id: 'a1', date: '2026-01-01', areas: [area({ level: 1 })] });
    const newer = assessment({ id: 'a2', date: '2026-02-01', areas: [area({ level: 3 })] });
    expect(summarize([older, newer])).toEqual({ totalAssessments: 2, latestProfile: 3 });
  });

  it('is empty with no assessments', () => {
    expect(summarize([])).toEqual({ totalAssessments: 0, latestProfile: null });
  });
});

describe('newAssessmentFields', () => {
  it('starts with the six built-in areas, unrated, when there is no previous assessment', () => {
    const fields = newAssessmentFields(null, '2026-02-01');
    expect(fields.date).toBe('2026-02-01');
    expect(fields.areas).toHaveLength(6);
    expect(fields.areas.every((a) => a.level === undefined)).toBe(true);
    expect(fields.areas.map((a) => a.key)).toEqual([
      'work',
      'family',
      'money',
      'health',
      'learning',
      'community',
    ]);
  });

  it('carries over names and keys from the latest assessment, levels and notes reset', () => {
    const latest = assessment({
      areas: [
        area({ id: 'p1', key: 'work', level: 2, note: 'Busy quarter' }),
        area({ id: 'p2', key: undefined, name: 'Volunteering', level: 1 }),
      ],
    });
    const fields = newAssessmentFields(latest, '2026-02-01');
    expect(fields.areas).toHaveLength(2);
    expect(fields.areas[0]).toMatchObject({ key: 'work' });
    expect(fields.areas[0].level).toBeUndefined();
    expect(fields.areas[0].note).toBeUndefined();
    expect(fields.areas[1]).toMatchObject({ name: 'Volunteering' });
    expect(fields.areas[0].id).not.toBe('p1');
  });
});

describe('addArea/renameArea/setAreaLevel/setAreaNote/removeArea', () => {
  it('adds a custom area with no level', () => {
    const result = addArea([], 'Volunteering');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Volunteering' });
    expect(result[0].level).toBeUndefined();
    expect(result[0].id).toBeTruthy();
  });

  it('renames an area, keeping its key', () => {
    const target = area({ id: 'a1', key: 'work' });
    const result = renameArea([target], 'a1', 'Day job');
    expect(result[0]).toMatchObject({ key: 'work', name: 'Day job' });
  });

  it('clears a blank name back to undefined instead of freezing on an empty string', () => {
    const target = area({ id: 'a1', key: 'work', name: 'Day job' });
    expect(renameArea([target], 'a1', '')[0].name).toBeUndefined();
    expect(renameArea([target], 'a1', '   ')[0].name).toBeUndefined();
  });

  it('sets an area level and note independently', () => {
    const target = area({ id: 'a1' });
    const withLevel = setAreaLevel([target], 'a1', 2);
    expect(withLevel[0].level).toBe(2);
    const withNote = setAreaNote(withLevel, 'a1', 'Feeling steadier');
    expect(withNote[0]).toMatchObject({ level: 2, note: 'Feeling steadier' });
  });

  it('removes only the matching area', () => {
    const target = area({ id: 'a1' });
    const other = area({ id: 'a2', key: 'family' });
    expect(removeArea([target, other], 'a1')).toEqual([other]);
  });
});

describe('addAssessment/editAssessment', () => {
  it('appends a new assessment stamped with a fresh id and the given time', () => {
    const result = addAssessment([], { date: '2026-01-01', areas: [] }, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: '2026-01-01',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it('merges fields into the matching live assessment only', () => {
    const target = assessment({ id: 'a1', areas: [] });
    const other = assessment({ id: 'a2', areas: [] });
    const newAreas = [area({ level: 1 })];
    const result = editAssessment([target, other], 'a1', { areas: newAreas });
    expect(result.find((a) => a.id === 'a1')?.areas).toEqual(newAreas);
    expect(result.find((a) => a.id === 'a2')?.areas).toEqual([]);
  });

  it('leaves a tombstoned assessment unchanged', () => {
    const deleted = assessment({ id: 'a1', areas: [], deletedAt: NOW.toISOString() });
    const result = editAssessment([deleted], 'a1', { areas: [area()] });
    expect(result[0].areas).toEqual([]);
  });
});

describe('removeAssessment/restoreAssessment (issue #203)', () => {
  const LATER = new Date('2026-01-02T00:00:00.000Z');

  it('tombstones the matching assessment, leaving others alone', () => {
    const target = assessment({ id: 'a1' });
    const other = assessment({ id: 'a2' });
    const result = removeAssessment([target, other], 'a1', LATER);

    expect(result.find((a) => a.id === 'a1')?.deletedAt).toBe(LATER.toISOString());
    expect(result.find((a) => a.id === 'a2')?.deletedAt).toBeUndefined();
  });

  it('restore clears the tombstone and bumps updatedAt', () => {
    const deleted = assessment({ id: 'a1', deletedAt: LATER.toISOString() });
    const result = restoreAssessment([deleted], 'a1', LATER);

    expect(result[0].deletedAt).toBeUndefined();
    expect(result[0].updatedAt).toBe(LATER.toISOString());
  });

  it('restore is a no-op for an id that was never deleted', () => {
    const live = assessment({ id: 'a1' });
    const result = restoreAssessment([live], 'a1', LATER);

    expect(result[0]).toBe(live);
  });

  it('restore is a no-op for an unknown id', () => {
    const deleted = assessment({ id: 'a1', deletedAt: LATER.toISOString() });
    const result = restoreAssessment([deleted], 'not-found', LATER);

    expect(result[0]).toBe(deleted);
  });
});

describe('isStarted (issue #216)', () => {
  it('is false with no assessments at all', () => {
    expect(isStarted([])).toBe(false);
  });

  it('is false when every assessment is tombstoned', () => {
    expect(isStarted([assessment({ deletedAt: NOW.toISOString() })])).toBe(false);
  });

  it('is true once any live assessment exists', () => {
    expect(
      isStarted([assessment({ id: 'x1', deletedAt: NOW.toISOString() }), assessment({ id: 'x2' })]),
    ).toBe(true);
  });
});
