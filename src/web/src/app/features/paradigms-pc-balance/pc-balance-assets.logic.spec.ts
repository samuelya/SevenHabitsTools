import {
  addBuiltInAsset,
  addNamedAsset,
  builtInKeyForName,
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
});

describe('addNamedAsset', () => {
  it('appends a custom asset with the trimmed name and a fresh key', () => {
    const result = addNamedAsset([], '  My back ', 'physical', LABELS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assets).toEqual([
        { key: result.key, name: 'My back', group: 'physical', p: 3, pc: 3 },
      ]);
      expect(result.key).not.toBe('');
    }
  });

  it("adds the built-in for one of the group's labels, in either language", () => {
    const result = addNamedAsset([], 'النوم', 'physical', LABELS);
    expect(result).toMatchObject({ ok: true, key: 'sleep' });
    if (result.ok) {
      expect(result.assets[0]).toMatchObject({ key: 'sleep', name: '' });
    }
  });

  it('refuses a blank name', () => {
    expect(addNamedAsset([], '   ', 'physical', LABELS)).toEqual({ ok: false, reason: 'blank' });
  });

  it('refuses a name the audit already holds, typed or built-in', () => {
    const assets = [asset({ name: 'My back' }), asset({ key: 'sleep', name: '' })];
    expect(addNamedAsset(assets, 'my BACK', 'physical', LABELS)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(addNamedAsset(assets, 'Sleep', 'physical', LABELS)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(addNamedAsset(assets, 'النوم', 'physical', LABELS)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });
});

describe('hasAssetData', () => {
  it('is true once a slider moved off 3 or an action is typed', () => {
    expect(hasAssetData({ p: 3, pc: 3 })).toBe(false);
    expect(hasAssetData({ p: 3, pc: 3, action: '  ' })).toBe(false);
    expect(hasAssetData({ p: 4, pc: 3 })).toBe(true);
    expect(hasAssetData({ p: 3, pc: 2 })).toBe(true);
    expect(hasAssetData({ p: 3, pc: 3, action: 'Walk' })).toBe(true);
  });
});

describe('restoreAsset', () => {
  it('puts the asset back at its index, or at the end of a shorter list', () => {
    const a = asset({ key: 'a' });
    const b = asset({ key: 'b' });
    const c = asset({ key: 'c' });
    expect(restoreAsset([a, c], b, 1)).toEqual([a, b, c]);
    expect(restoreAsset([a], c, 5)).toEqual([a, c]);
  });

  it('adds nothing when the asset is already there', () => {
    const a = asset({ key: 'a' });
    expect(restoreAsset([a], a, 0)).toEqual([a]);
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
