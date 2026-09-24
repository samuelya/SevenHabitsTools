import { MaturityArea } from './maturity.model';
import {
  addBuiltInArea,
  addCustomArea,
  areaChips,
  areaKeyOf,
  builtInKeyForName,
  hasAreaData,
  restoreArea,
} from './maturity-areas.logic';

function area(overrides: Partial<MaturityArea> = {}): MaturityArea {
  return { id: 'ar1', key: 'work', ...overrides };
}

const LABELS = {
  work: 'Work',
  family: 'Family',
  community: 'Community',
  friendships: 'Friendships',
};

describe('built-in names (#222 review)', () => {
  it('finds the built-in key for its label in either locale, trimmed and case-insensitively', () => {
    expect(builtInKeyForName(' FRIENDSHIPS ')).toBe('friendships');
    expect(builtInKeyForName('العمل')).toBe('work');
    expect(builtInKeyForName('Volunteering')).toBeUndefined();
  });

  it('an area stands for its key, else for a built-in its custom name matches', () => {
    expect(areaKeyOf({ key: 'work', name: 'Day job' })).toBe('work');
    expect(areaKeyOf({ name: 'Friendships' })).toBe('friendships');
    expect(areaKeyOf({ name: 'Volunteering' })).toBeUndefined();
  });

  it('an area holds data once it has a level or a non-blank note', () => {
    expect(hasAreaData(area())).toBe(false);
    expect(hasAreaData(area({ note: '  ' }))).toBe(false);
    expect(hasAreaData(area({ level: 1 }))).toBe(true);
    expect(hasAreaData(area({ note: 'Busy' }))).toBe(true);
  });
});

describe('areaChips (#222)', () => {
  it('offers every suggested key, pressed with the area standing for it', () => {
    const chips = areaChips([area({ id: 'a1', key: 'family' })], ['work', 'family'], LABELS);
    expect(chips).toEqual([
      { id: 'key:work', key: 'work', label: 'Work', pressed: false },
      { id: 'key:family', key: 'family', areaId: 'a1', label: 'Family', pressed: true },
    ]);
  });

  it('adds a pressed chip for every other area: custom, unsuggested built-ins and a second area for a key', () => {
    const chips = areaChips(
      [
        area({ id: 'c1', key: 'community' }),
        area({ id: 'c2', key: undefined, name: 'Volunteering' }),
        area({ id: 'c3', key: 'work' }),
        area({ id: 'c4', key: 'work', name: 'Side project' }),
      ],
      ['work'],
      LABELS,
    );
    expect(chips).toEqual([
      { id: 'key:work', key: 'work', areaId: 'c3', label: 'Work', pressed: true },
      { id: 'c1', areaId: 'c1', label: 'Community', pressed: true },
      { id: 'c2', areaId: 'c2', label: 'Volunteering', pressed: true },
      { id: 'c4', areaId: 'c4', label: 'Side project', pressed: true },
    ]);
  });

  it('shows a renamed built-in by its stored name on its own chip (#222 review)', () => {
    const chips = areaChips([area({ id: 'c1', key: 'work', name: 'Day job' })], ['work'], LABELS);
    expect(chips).toEqual([
      { id: 'key:work', key: 'work', areaId: 'c1', label: 'Day job', pressed: true },
    ]);
  });

  it('puts a custom area named like a built-in on that chip: no second "Friendships" (#222 review)', () => {
    const chips = areaChips(
      [area({ id: 'c1', key: undefined, name: 'friendships' })],
      ['work', 'friendships'],
      LABELS,
    );
    expect(chips).toEqual([
      { id: 'key:work', key: 'work', label: 'Work', pressed: false },
      {
        id: 'key:friendships',
        key: 'friendships',
        areaId: 'c1',
        label: 'friendships',
        pressed: true,
      },
    ]);
  });
});

describe('adding and restoring areas (#222)', () => {
  it('adds an unrated built-in area with a fresh id', () => {
    const added = addBuiltInArea([area({ id: 'x', key: 'family' })], 'work');
    expect(added).toHaveLength(2);
    expect(added[1]).toMatchObject({ key: 'work' });
    expect(added[1].level).toBeUndefined();
    expect(added[1].id).toBeTruthy();
  });

  it('adds a trimmed custom area', () => {
    const result = addCustomArea([], '  Volunteering ', LABELS);
    expect(result.ok).toBe(true);
    const areas = result.ok ? result.areas : [];
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ name: 'Volunteering' });
    expect(areas[0].key).toBeUndefined();
  });

  it('refuses a blank name, and a duplicate of a listed area (#222 review)', () => {
    expect(addCustomArea([], '   ', LABELS)).toEqual({ ok: false, reason: 'blank' });
    const listed = [area({ id: 'c1', key: undefined, name: 'Volunteering' })];
    expect(addCustomArea(listed, 'volunteering', LABELS)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    const renamed = [area({ id: 'c2', key: 'work', name: 'Day job' })];
    expect(addCustomArea(renamed, 'DAY JOB', LABELS)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('adds a built-in label not in the list as that built-in, in either locale (#222 re-review R1)', () => {
    for (const [typed, key] of [
      ['Community', 'community'],
      [' health', 'health'],
      ['الصحة', 'health'],
    ] as const) {
      const result = addCustomArea([area({ id: 'w' })], typed, LABELS);
      expect(result.ok).toBe(true);
      const added = result.ok ? result.areas[1] : undefined;
      expect(added?.key).toBe(key);
      expect(added?.name).toBeUndefined();
    }
  });

  it('refuses a built-in label whose built-in is already listed, by key or by name (#222 review)', () => {
    expect(addCustomArea([area({ id: 'w' })], 'work', LABELS)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    const custom = [area({ id: 'f', key: undefined, name: 'Friendships' })];
    expect(addCustomArea(custom, 'FRIENDSHIPS', LABELS)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    const renamed = [area({ id: 'd', key: 'work', name: 'Day job' })];
    expect(addCustomArea(renamed, 'Work', LABELS)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('restores a removed area where it was, once', () => {
    const a = area({ id: 'a' });
    const b = area({ id: 'b', level: 2, note: 'Kept' });
    const c = area({ id: 'c' });
    expect(restoreArea([a, c], b, 1)).toEqual([a, b, c]);
    expect(restoreArea([a], b, 5)).toEqual([a, b]);
    expect(restoreArea([a, b, c], b, 1)).toEqual([a, b, c]);
  });
});
