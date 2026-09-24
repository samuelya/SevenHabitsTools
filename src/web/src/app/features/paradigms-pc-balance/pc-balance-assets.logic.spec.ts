import {
  addBuiltInAsset,
  addNamedAsset,
  builtInKeyForName,
  builtInLabelsFrom,
  builtInKeyOf,
  displayName,
  firstOfEachStatus,
  hasAssetData,
  restoreAsset,
  suggestedAssets,
} from './pc-balance-assets.logic';
import { PcAsset } from './pc-balance.model';

const LABELS = {
  sleep: 'Sleep',
  exercise: 'Exercise',
  savings: 'Savings',
  incomeSkills: 'Income skills',
  partner: 'Partner',
  team: 'Team',
};

function asset(overrides: Partial<PcAsset> = {}): PcAsset {
  return { key: 'u1', name: 'My back', group: 'physical', p: 3, pc: 3, ...overrides };
}

describe('builtInKeyForName/builtInKeyOf', () => {
  it("matches a group's built-in label in either language, trimmed and case-insensitive", () => {
    expect(builtInKeyForName('  sLeeP ', 'physical')).toBe('sleep');
    expect(builtInKeyForName('المدخرات', 'financial')).toBe('savings');
    expect(builtInKeyForName('Income skills', 'financial')).toBe('incomeSkills');
  });

  it("does not match another group's built-in, or any other name", () => {
    expect(builtInKeyForName('Savings', 'physical')).toBeUndefined();
    expect(builtInKeyForName('My back', 'physical')).toBeUndefined();
  });

  it('reads a built-in key, else a name equal to a built-in label (a pre-#223 audit)', () => {
    expect(builtInKeyOf(asset({ key: 'team', name: '', group: 'human' }))).toBe('team');
    expect(builtInKeyOf(asset({ key: 'u2', name: 'Sleep' }))).toBe('sleep');
    expect(builtInKeyOf(asset())).toBeUndefined();
  });
});

describe('displayName', () => {
  it("shows a suggested asset's translated label, and a typed name as typed", () => {
    expect(displayName({ key: 'sleep', name: '' }, LABELS)).toBe('Sleep');
    expect(displayName({ key: 'u1', name: 'My back' }, LABELS)).toBe('My back');
    expect(displayName({ key: 'u1', name: '' }, LABELS)).toBe('');
  });
});

describe('builtInLabelsFrom', () => {
  it('maps each built-in key to its label once every label has loaded, else null', () => {
    const loaded = ['Sleep', 'Exercise', 'Savings', 'Income skills', 'Partner', 'Team'];
    expect(builtInLabelsFrom(loaded)).toEqual(LABELS);
    expect(builtInLabelsFrom(['', '', '', '', '', ''])).toBeNull();
    expect(builtInLabelsFrom(['Sleep'])).toBeNull();
  });
});

describe('suggestedAssets', () => {
  it("offers a group's two built-ins until the audit holds them", () => {
    expect(suggestedAssets([], 'physical')).toEqual(['sleep', 'exercise']);
    expect(suggestedAssets([], 'financial')).toEqual(['savings', 'incomeSkills']);
    expect(suggestedAssets([], 'human')).toEqual(['partner', 'team']);
    expect(suggestedAssets([asset({ key: 'sleep', name: '' })], 'physical')).toEqual(['exercise']);
  });

  it('treats an older custom asset named like a built-in as that built-in', () => {
    expect(suggestedAssets([asset({ name: 'exercise' })], 'physical')).toEqual(['sleep']);
  });

  it('hides a chip whose label an asset of another group is already shown under (F7)', () => {
    const assets = [asset({ name: 'Sleep', group: 'human' })];
    expect(suggestedAssets(assets, 'physical')).toEqual(['exercise']);
  });
});

describe('addBuiltInAsset', () => {
  it('appends the built-in with its key, an empty name, its group and sliders at 3', () => {
    expect(addBuiltInAsset([], 'incomeSkills')).toEqual([
      { key: 'incomeSkills', name: '', group: 'financial', p: 3, pc: 3 },
    ]);
  });

  it('adds nothing when the audit already holds it', () => {
    const assets = [asset({ key: 'u2', name: 'Sleep' })];
    expect(addBuiltInAsset(assets, 'sleep')).toEqual(assets);
  });

  it('adds nothing when an asset of another group is shown under its name, in either language (F7)', () => {
    expect(addBuiltInAsset([asset({ name: 'sleep', group: 'human' })], 'sleep')).toHaveLength(1);
    expect(addBuiltInAsset([asset({ name: 'النوم', group: 'human' })], 'sleep')).toHaveLength(1);
  });
});

describe('addNamedAsset', () => {
  it('appends a custom asset with the trimmed name and a fresh key', () => {
    const result = addNamedAsset([], '  My back ', 'physical');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assets).toEqual([
        { key: result.key, name: 'My back', group: 'physical', p: 3, pc: 3 },
      ]);
      expect(result.key).not.toBe('');
    }
  });

  it("adds the built-in for one of the group's labels, in either language", () => {
    const result = addNamedAsset([], 'النوم', 'physical');
    expect(result).toMatchObject({ ok: true, key: 'sleep' });
    if (result.ok) {
      expect(result.assets[0]).toMatchObject({ key: 'sleep', name: '' });
    }
  });

  it('refuses a blank name', () => {
    expect(addNamedAsset([], '   ', 'physical')).toEqual({ ok: false, reason: 'blank' });
  });

  it('refuses a name the audit already holds, typed or built-in', () => {
    const assets = [asset({ name: 'My back' }), asset({ key: 'sleep', name: '' })];
    expect(addNamedAsset(assets, 'my BACK', 'physical')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(addNamedAsset(assets, 'Sleep', 'physical')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(addNamedAsset(assets, 'النوم', 'physical')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('refuses a name a built-in is shown under in the other language, whichever came first (F7)', () => {
    const sleep = asset({ key: 'sleep', name: '' });
    expect(addNamedAsset([sleep], 'النوم', 'human')).toEqual({ ok: false, reason: 'duplicate' });
    const typed = asset({ name: 'النوم', group: 'human' });
    expect(addNamedAsset([typed], 'Sleep', 'physical')).toEqual({ ok: false, reason: 'duplicate' });
  });
});

describe('hasAssetData', () => {
  it('is true once a slider moved off 3 or an action is typed', () => {
    expect(hasAssetData({ name: '', p: 3, pc: 3 })).toBe(false);
    expect(hasAssetData({ name: '', p: 3, pc: 3, action: '  ' })).toBe(false);
    expect(hasAssetData({ name: '', p: 4, pc: 3 })).toBe(true);
    expect(hasAssetData({ name: '', p: 3, pc: 2 })).toBe(true);
    expect(hasAssetData({ name: '', p: 3, pc: 3, action: 'Walk' })).toBe(true);
  });

  it('counts a typed or renamed name as data (F8)', () => {
    expect(hasAssetData({ name: 'My back', p: 3, pc: 3 })).toBe(true);
    expect(hasAssetData({ name: '  ', p: 3, pc: 3 })).toBe(false);
  });
});

describe('restoreAsset', () => {
  it('puts the asset back at its index, or at the end of a shorter list', () => {
    const a = asset({ key: 'a', name: 'A' });
    const b = asset({ key: 'b', name: 'B' });
    const c = asset({ key: 'c', name: 'C' });
    expect(restoreAsset([a, c], b, 1)).toEqual([a, b, c]);
    expect(restoreAsset([a], c, 5)).toEqual([a, c]);
  });

  it('adds nothing when the asset is already there', () => {
    const a = asset({ key: 'a' });
    expect(restoreAsset([a], a, 0)).toEqual([a]);
  });

  it('puts the ratings back into a built-in re-added since, without a second row (F4)', () => {
    const other = asset({ key: 'u9', name: 'My back' });
    const removed = asset({ key: 'sleep', name: '', p: 5, pc: 1, action: 'Bed by 11' });
    const readded = asset({ key: 'sleep', name: '' });
    expect(restoreAsset([other, readded], removed, 0)).toEqual([other, removed]);
  });

  it('puts an older typed built-in back in place of the chip re-added since (F4)', () => {
    const removed = asset({ key: 'u2', name: 'Sleep', p: 5, pc: 1 });
    const readded = asset({ key: 'sleep', name: '' });
    expect(restoreAsset([readded], removed, 0)).toEqual([removed]);
  });

  it('puts a custom asset back in place of one retyped under its name since (F4)', () => {
    const removed = asset({ key: 'u2', name: 'Gym', p: 5 });
    const retyped = asset({ key: 'u3', name: 'gym' });
    expect(restoreAsset([retyped], removed, 0)).toEqual([removed]);
  });
});

describe('firstOfEachStatus', () => {
  it('names the first asset with each status, in group order then stored order', () => {
    const assets = [
      asset({ key: 'h1', group: 'human', p: 5, pc: 1 }),
      asset({ key: 'p1', group: 'physical', p: 3, pc: 3 }),
      asset({ key: 'p2', group: 'physical', p: 3, pc: 3 }),
      asset({ key: 'f1', group: 'financial', p: 1, pc: 5 }),
      asset({ key: 'h2', group: 'human', p: 5, pc: 2 }),
    ];
    expect([...firstOfEachStatus(assets)]).toEqual(['p1', 'f1', 'h1']);
  });
});
