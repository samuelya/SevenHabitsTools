import { asset as arAssetLabels } from './i18n/ar.json';
import { asset as enAssetLabels } from './i18n/en.json';
import { balanceOf, DEFAULT_SLIDER_VALUE, PcBalanceStatus, statusOf } from './pc-balance.logic';
import {
  isBuiltInAssetKey,
  PC_BALANCE_GROUPS,
  PC_SUGGESTED_ASSETS,
  PcAsset,
  PcBalanceGroup,
  PcBuiltInAssetKey,
} from './pc-balance.model';

/** Asset names, the suggested-asset chips and adding/restoring an asset (issue #223). Pure; the
 * form reads it. */

function fold(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** The built-in key of `group` whose label, in any locale, is `name` (trimmed, case-insensitive);
 * `undefined` for any other name. Read from the feature's own i18n files, so the match doesn't
 * depend on the current language. Only that group's suggestions count: "Savings" typed under
 * Physical is a custom asset. */
export function builtInKeyForName(
  name: string,
  group: PcBalanceGroup,
): PcBuiltInAssetKey | undefined {
  const folded = fold(name);
  return PC_SUGGESTED_ASSETS[group].find((key) =>
    [enAssetLabels, arAssetLabels].some((labels) => fold(labels[key]) === folded),
  );
}

/** The built-in an asset stands for: its `key` when that is a built-in key, else a name equal to
 * one of its group's built-in labels (an audit from before #223, where "Sleep" was typed). */
export function builtInKeyOf(
  asset: Pick<PcAsset, 'key' | 'name' | 'group'>,
): PcBuiltInAssetKey | undefined {
  if (isBuiltInAssetKey(asset.key)) {
    return asset.key;
  }
  return builtInKeyForName(asset.name, asset.group);
}

/** Already-translated display name: the typed name if any, else the built-in's label. */
export function displayName(
  asset: Pick<PcAsset, 'key' | 'name'>,
  builtInLabels: Readonly<Record<string, string>>,
): string {
  const name = asset.name.trim();
  if (name !== '' || !isBuiltInAssetKey(asset.key)) {
    return asset.name;
  }
  return builtInLabels[asset.key] ?? '';
}

/** The suggested chips still to offer in `group`: its two built-ins, minus any the audit holds. */
export function suggestedAssets(
  assets: readonly PcAsset[],
  group: PcBalanceGroup,
): PcBuiltInAssetKey[] {
  const held = new Set(assets.map(builtInKeyOf));
  return PC_SUGGESTED_ASSETS[group].filter((key) => !held.has(key));
}

function newAsset(key: string, name: string, group: PcBalanceGroup): PcAsset {
  return { key, name, group, p: DEFAULT_SLIDER_VALUE, pc: DEFAULT_SLIDER_VALUE };
}

/** A suggested chip: appends the built-in asset `key` with both sliders at 3; a no-op copy if the
 * audit already holds it. */
export function addBuiltInAsset(assets: readonly PcAsset[], key: PcBuiltInAssetKey): PcAsset[] {
  if (assets.some((asset) => builtInKeyOf(asset) === key)) {
    return [...assets];
  }
  const group = PC_BALANCE_GROUPS.find((candidate) =>
    (PC_SUGGESTED_ASSETS[candidate] as readonly string[]).includes(key),
  ) as PcBalanceGroup;
  return [...assets, newAsset(key, '', group)];
}

export type AddNamedAssetResult =
  | { readonly ok: true; readonly assets: PcAsset[]; readonly key: string }
  | { readonly ok: false; readonly reason: 'blank' | 'duplicate' };

/** The group's free-text field: appends an asset named `name` (trimmed), or the built-in its
 * label stands for. Refused for a blank name, and for a name the audit already holds: any
 * asset's displayed name in either language, or the built-in it stands for. */
export function addNamedAsset(
  assets: readonly PcAsset[],
  name: string,
  group: PcBalanceGroup,
  builtInLabels: Readonly<Record<string, string>>,
): AddNamedAssetResult {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'blank' };
  }
  const folded = fold(trimmed);
  const key = builtInKeyForName(trimmed, group);
  const duplicate = assets.some(
    (asset) =>
      fold(displayName(asset, builtInLabels)) === folded ||
      (key !== undefined && builtInKeyOf(asset) === key),
  );
  if (duplicate) {
    return { ok: false, reason: 'duplicate' };
  }
  if (key !== undefined) {
    return { ok: true, assets: addBuiltInAsset(assets, key), key };
  }
  const added = newAsset(crypto.randomUUID(), trimmed, group);
  return { ok: true, assets: [...assets, added], key: added.key };
}

/** Whether removing the asset loses a rating or action the user entered (so it is confirmed). */
export function hasAssetData(asset: Pick<PcAsset, 'p' | 'pc' | 'action'>): boolean {
  return (
    asset.p !== DEFAULT_SLIDER_VALUE ||
    asset.pc !== DEFAULT_SLIDER_VALUE ||
    (asset.action ?? '').trim() !== ''
  );
}

/** Undo of a removed asset: puts `asset` back at `index` (or the end, if the list got shorter); a
 * no-op copy if an asset with its key is already there. */
export function restoreAsset(assets: readonly PcAsset[], asset: PcAsset, index: number): PcAsset[] {
  if (assets.some((candidate) => candidate.key === asset.key)) {
    return [...assets];
  }
  const at = Math.max(0, Math.min(index, assets.length));
  return [...assets.slice(0, at), asset, ...assets.slice(at)];
}

/** The keys of the assets whose status line carries its plain gloss (issue #223): the first asset
 * with each status, in the order the form shows them (by group, then as stored). */
export function firstOfEachStatus(assets: readonly PcAsset[]): ReadonlySet<string> {
  const seen = new Set<PcBalanceStatus>();
  const keys = new Set<string>();
  for (const group of PC_BALANCE_GROUPS) {
    for (const asset of assets) {
      if (asset.group !== group) {
        continue;
      }
      const status = statusOf(balanceOf(asset));
      if (!seen.has(status)) {
        seen.add(status);
        keys.add(asset.key);
      }
    }
  }
  return keys;
}
