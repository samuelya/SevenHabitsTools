import { PcAsset, PcAudit } from './pc-balance.model';
import {
  isDraftWorthSaving,
  auditAverageBalance,
  balanceOf,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editAsset,
  editAudit,
  groupSummaries,
  isAssetComplete,
  isAssetNamed,
  isAuditComplete,
  isComplete,
  isOverUsed,
  newAuditFields,
  removeAsset,
  removeAudit,
  restoreAudit,
  statusOf,
  summarize,
  isStarted,
} from './pc-balance.logic';
import { hubStatus } from './pc-balance.logic';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function asset(overrides: Partial<PcAsset> = {}): PcAsset {
  return { key: 'k1', name: 'Health', group: 'physical', p: 3, pc: 3, ...overrides };
}

function audit(overrides: Partial<PcAudit> = {}): PcAudit {
  return {
    id: 'a1',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    date: '2026-01-01',
    assets: [],
    reflection: '',
    ...overrides,
  };
}

describe('balanceOf/statusOf', () => {
  it('is over-used at a balance of 2 or more', () => {
    expect(statusOf(balanceOf({ p: 5, pc: 3 }))).toBe('overUsed');
    expect(statusOf(balanceOf({ p: 4, pc: 2 }))).toBe('overUsed');
  });

  it('is under-used at a balance of -2 or less', () => {
    expect(statusOf(balanceOf({ p: 1, pc: 3 }))).toBe('underUsed');
  });

  it('is balanced between -2 and 2, exclusive of the thresholds', () => {
    expect(statusOf(balanceOf({ p: 3, pc: 3 }))).toBe('balanced');
    expect(statusOf(balanceOf({ p: 4, pc: 3 }))).toBe('balanced');
    expect(statusOf(balanceOf({ p: 2, pc: 3 }))).toBe('balanced');
  });
});

describe('isAssetComplete', () => {
  it('is true for a balanced or under-used asset regardless of action', () => {
    expect(isAssetComplete(asset({ p: 3, pc: 3, action: undefined }))).toBe(true);
    expect(isAssetComplete(asset({ p: 1, pc: 5, action: undefined }))).toBe(true);
  });

  it('requires an action once over-used', () => {
    expect(isAssetComplete(asset({ p: 5, pc: 1, action: undefined }))).toBe(false);
    expect(isAssetComplete(asset({ p: 5, pc: 1, action: '   ' }))).toBe(false);
    expect(isAssetComplete(asset({ p: 5, pc: 1, action: 'Schedule a rest day' }))).toBe(true);
  });

  it('requires a non-blank name, regardless of balance', () => {
    expect(isAssetComplete(asset({ name: '', p: 3, pc: 3 }))).toBe(false);
    expect(isAssetComplete(asset({ name: '   ', p: 3, pc: 3 }))).toBe(false);
  });
});

describe('isAuditComplete/isComplete', () => {
  it('is false with no assets', () => {
    expect(isAuditComplete(audit({ assets: [] }))).toBe(false);
  });

  it('is false while an over-used asset has no action', () => {
    expect(isAuditComplete(audit({ assets: [asset({ p: 5, pc: 1 })] }))).toBe(false);
  });

  it('is true once every over-used asset has an action', () => {
    expect(
      isAuditComplete(
        audit({ assets: [asset({ p: 5, pc: 1, action: 'Rest' }), asset({ key: 'k2' })] }),
      ),
    ).toBe(true);
  });

  it('isComplete ignores a tombstoned audit', () => {
    const complete = audit({
      id: 'a1',
      assets: [asset()],
      deletedAt: NOW.toISOString(),
    });
    expect(isComplete([complete])).toBe(false);
  });

  it('isComplete is true once at least one live audit is complete', () => {
    const incomplete = audit({ id: 'a1', assets: [] });
    const complete = audit({ id: 'a2', assets: [asset()] });
    expect(isComplete([incomplete, complete])).toBe(true);
  });
});

const LABELS = checklistLabelsFrom(['Name', 'Actions']);

describe('doneChecklist', () => {
  const met = (audits: PcAudit[]) => doneChecklist(audits, LABELS).map((item) => item.met);

  it('lists both items, unmet, with no audits', () => {
    expect(doneChecklist([], LABELS)).toEqual([
      { label: 'Name', met: false },
      { label: 'Actions', met: false },
    ]);
  });

  it('leaves both unmet for an audit with no assets', () => {
    expect(met([audit({ assets: [] })])).toEqual([false, false]);
  });

  it('asks for the action while an over-used asset has none', () => {
    expect(met([audit({ assets: [asset({ p: 5, pc: 1 })] })])).toEqual([true, false]);
  });

  it('asks for a name again once an asset is renamed blank', () => {
    expect(met([audit({ assets: [asset({ name: ' ' })] })])).toEqual([false, true]);
  });

  it('describes the live audit closest to complete, ignoring tombstones', () => {
    const audits = [
      audit({ id: 'a1', assets: [] }),
      audit({ id: 'a2', assets: [asset({ p: 5, pc: 1 })] }),
      audit({ id: 'a3', assets: [asset()], deletedAt: NOW.toISOString() }),
    ];
    expect(met(audits)).toEqual([true, false]);
  });

  it('is all met exactly when isComplete is true', () => {
    const cases: PcAudit[][] = [
      [],
      [audit({ assets: [] })],
      [audit({ assets: [asset({ p: 5, pc: 1 })] })],
      [audit({ assets: [asset({ p: 5, pc: 1, action: 'Rest' })] })],
      [audit({ assets: [asset()], deletedAt: NOW.toISOString() })],
    ];
    for (const audits of cases) {
      expect(doneChecklist(audits, LABELS).every((item) => item.met)).toBe(isComplete(audits));
    }
  });
});

describe('checklistLoaded', () => {
  it("is false for translateSignal's before-load [''] and true once labels arrive", () => {
    expect(checklistLoaded(checklistLabelsFrom(['']))).toBe(false);
    expect(checklistLoaded(LABELS)).toBe(true);
  });
});

describe('auditAverageBalance', () => {
  it('is null with no assets', () => {
    expect(auditAverageBalance(audit({ assets: [] }))).toBeNull();
  });

  it('is the mean of p - pc, to 1 decimal', () => {
    const assets = [asset({ key: 'k1', p: 5, pc: 3 }), asset({ key: 'k2', p: 2, pc: 4 })];
    // (2 + -2) / 2 = 0
    expect(auditAverageBalance(audit({ assets }))).toBe(0);
    const uneven = [asset({ key: 'k1', p: 5, pc: 3 }), asset({ key: 'k2', p: 3, pc: 3 })];
    // (2 + 0) / 2 = 1
    expect(auditAverageBalance(audit({ assets: uneven }))).toBe(1);
    const rounding = [asset({ key: 'k1', p: 5, pc: 3 }), asset({ key: 'k2', p: 4, pc: 3 })];
    // (2 + 1) / 2 = 1.5
    expect(auditAverageBalance(audit({ assets: rounding }))).toBe(1.5);
  });
});

describe('groupSummaries', () => {
  it('reports one entry per group, in group order, null average with no assets', () => {
    const summaries = groupSummaries([]);
    expect(summaries.map((s) => s.group)).toEqual(['physical', 'financial', 'human']);
    expect(summaries.every((s) => s.averageBalance === null)).toBe(true);
  });

  it('averages and counts only the assets in that group', () => {
    const assets = [
      asset({ key: 'k1', group: 'physical', p: 5, pc: 3 }), // over-used
      asset({ key: 'k2', group: 'physical', p: 3, pc: 3 }), // balanced
      asset({ key: 'k3', group: 'financial', p: 1, pc: 4 }), // under-used
    ];
    const summaries = groupSummaries(assets);
    const physical = summaries.find((s) => s.group === 'physical')!;
    expect(physical.averageBalance).toBe(1);
    expect(physical.overUsed).toBe(1);
    expect(physical.balanced).toBe(1);
    const financial = summaries.find((s) => s.group === 'financial')!;
    expect(financial.underUsed).toBe(1);
    const human = summaries.find((s) => s.group === 'human')!;
    expect(human.averageBalance).toBeNull();
  });
});

describe('summarize', () => {
  it('counts only live audits and reports the latest one’s average balance', () => {
    const older = audit({ id: 'a1', date: '2026-01-01', assets: [asset({ p: 3, pc: 3 })] });
    const newer = audit({ id: 'a2', date: '2026-02-01', assets: [asset({ p: 5, pc: 3 })] });
    const deleted = audit({ id: 'a3', date: '2026-03-01', deletedAt: NOW.toISOString() });
    expect(summarize([older, newer, deleted])).toEqual({ totalAudits: 2, latestAverageBalance: 2 });
  });

  it('is empty with no audits', () => {
    expect(summarize([])).toEqual({ totalAudits: 0, latestAverageBalance: null });
  });
});

describe('newAuditFields', () => {
  it('starts with no assets when there is no previous audit', () => {
    expect(newAuditFields(null, '2026-02-01')).toEqual({
      date: '2026-02-01',
      assets: [],
      reflection: '',
    });
  });

  it('carries over names and groups from the latest audit, sliders reset to 3, no action', () => {
    const latest = audit({
      assets: [
        asset({ key: 'k1', name: 'Health', group: 'physical', p: 5, pc: 1, action: 'Rest' }),
      ],
    });
    const fields = newAuditFields(latest, '2026-02-01');
    expect(fields.date).toBe('2026-02-01');
    expect(fields.reflection).toBe('');
    expect(fields.assets).toHaveLength(1);
    expect(fields.assets[0]).toMatchObject({ name: 'Health', group: 'physical', p: 3, pc: 3 });
    expect(fields.assets[0].action).toBeUndefined();
    expect(fields.assets[0].key).not.toBe('k1');
  });

  it("keeps a suggested asset's built-in key (#223)", () => {
    const latest = audit({ assets: [asset({ key: 'sleep', name: '', p: 5, pc: 1 })] });
    const fields = newAuditFields(latest, '2026-02-01');
    expect(fields.assets[0]).toMatchObject({ key: 'sleep', name: '', p: 3, pc: 3 });
  });
});

describe('isAssetNamed/isAssetComplete (#223)', () => {
  it('counts a suggested asset, whose name is its built-in key, as named', () => {
    expect(isAssetNamed({ key: 'sleep', name: '' })).toBe(true);
    expect(isAssetComplete(asset({ key: 'sleep', name: '' }))).toBe(true);
  });

  it('does not count a blank custom asset as named', () => {
    expect(isAssetNamed({ key: 'uuid-1', name: '  ' })).toBe(false);
  });

  it('lets an audit of suggested assets meet the checklist', () => {
    const audits = [audit({ assets: [asset({ key: 'team', name: '', group: 'human' })] })];
    expect(isComplete(audits)).toBe(true);
  });
});

describe('editAsset/removeAsset', () => {
  it('edits only the matching asset', () => {
    const target = asset({ key: 'k1', name: 'old' });
    const other = asset({ key: 'k2', name: 'other' });
    const result = editAsset([target, other], 'k1', { name: 'new' });
    expect(result.find((a) => a.key === 'k1')?.name).toBe('new');
    expect(result.find((a) => a.key === 'k2')?.name).toBe('other');
  });

  it('removes only the matching asset', () => {
    const target = asset({ key: 'k1' });
    const other = asset({ key: 'k2' });
    expect(removeAsset([target, other], 'k1')).toEqual([other]);
  });
});

describe('editAudit', () => {
  it('merges fields into the matching live audit only', () => {
    const target = audit({ id: 'a1', reflection: 'old' });
    const other = audit({ id: 'a2', reflection: 'other' });
    const result = editAudit([target, other], 'a1', { reflection: 'new' });
    expect(result.find((a) => a.id === 'a1')?.reflection).toBe('new');
    expect(result.find((a) => a.id === 'a2')?.reflection).toBe('other');
  });

  it('leaves a tombstoned audit unchanged', () => {
    const deleted = audit({ id: 'a1', reflection: 'old', deletedAt: NOW.toISOString() });
    expect(editAudit([deleted], 'a1', { reflection: 'new' })[0].reflection).toBe('old');
  });

  it('is a no-op copy when the id is not found', () => {
    const target = audit({ id: 'a1' });
    expect(editAudit([target], 'missing', { reflection: 'new' })).toEqual([target]);
  });
});

describe('removeAudit/restoreAudit (issue #203)', () => {
  const LATER = new Date('2026-01-02T00:00:00.000Z');

  it('tombstones the matching audit, leaving others alone', () => {
    const target = audit({ id: 'a1' });
    const other = audit({ id: 'a2' });
    const result = removeAudit([target, other], 'a1', LATER);

    expect(result.find((a) => a.id === 'a1')?.deletedAt).toBe(LATER.toISOString());
    expect(result.find((a) => a.id === 'a2')?.deletedAt).toBeUndefined();
  });

  it('restore clears the tombstone and bumps updatedAt', () => {
    const deleted = audit({ id: 'a1', deletedAt: LATER.toISOString() });
    const result = restoreAudit([deleted], 'a1', LATER);

    expect(result[0].deletedAt).toBeUndefined();
    expect(result[0].updatedAt).toBe(LATER.toISOString());
  });

  it('restore is a no-op for an id that was never deleted', () => {
    const live = audit({ id: 'a1' });
    expect(restoreAudit([live], 'a1', LATER)[0]).toBe(live);
  });
});

describe('isOverUsed', () => {
  it('mirrors statusOf', () => {
    expect(isOverUsed({ p: 5, pc: 1 })).toBe(true);
    expect(isOverUsed({ p: 3, pc: 3 })).toBe(false);
  });
});

describe('isStarted (issue #216)', () => {
  it('is false with no audits at all', () => {
    expect(isStarted([])).toBe(false);
  });

  it('is false when every audit is tombstoned', () => {
    expect(isStarted([audit({ deletedAt: NOW.toISOString() })])).toBe(false);
  });

  it('is true once any live audit exists', () => {
    expect(
      isStarted([audit({ id: 'x1', deletedAt: NOW.toISOString() }), audit({ id: 'x2' })]),
    ).toBe(true);
  });
});

describe('isDraftWorthSaving (issue #217)', () => {
  const latest = {
    assets: [{ key: 'a', name: 'Sleep', group: 'physical', p: 5, pc: 1 }],
  } as unknown as PcAudit;
  const initial = newAuditFields(latest, '2026-01-01');

  it('is false for the untouched draft, copied assets and pre-filled date included', () => {
    expect(isDraftWorthSaving(initial, initial)).toBe(false);
    expect(isDraftWorthSaving({ ...initial, reflection: '  ' }, initial)).toBe(false);
  });

  it('is true once a slider moves, an asset is added or the reflection is written', () => {
    const moved = initial.assets.map((asset) => ({ ...asset, p: 4 }));
    expect(isDraftWorthSaving({ ...initial, assets: moved }, initial)).toBe(true);
    const added = [
      ...initial.assets,
      { key: 'b', name: 'Car', group: 'physical' as const, p: 3, pc: 3 },
    ];
    expect(isDraftWorthSaving({ ...initial, assets: added }, initial)).toBe(true);
    expect(isDraftWorthSaving({ ...initial, reflection: 'Rest more' }, initial)).toBe(true);
  });
});

describe('hubStatus (#219)', () => {
  it('is null with no live audit', () => {
    expect(hubStatus([])).toBeNull();
    expect(hubStatus([audit({ deletedAt: NOW.toISOString() })])).toBeNull();
  });

  it('counts live audits', () => {
    expect(hubStatus([audit()])).toEqual({
      key: 'habits.exercises.paradigms-pc-balance.auditCount',
      count: 1,
    });
  });
});
