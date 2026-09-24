import { asset as arAssetLabels } from './i18n/ar.json';
import { asset as enAssetLabels } from './i18n/en.json';
import { balanceOf, DEFAULT_SLIDER_VALUE, PcBalanceStatus, statusOf } from './pc-balance.logic';
import {
  isBuiltInAssetKey,
  PC_BALANCE_GROUPS,
  PC_BUILT_IN_ASSET_KEYS,
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

/** Each built-in key's label from `labels` (in `PC_BUILT_IN_ASSET_KEYS` order), or `null` while
 * the scope hasn't loaded and any label is still blank, so nothing renders a blank chip or name. */
export function builtInLabelsFrom(
  labels: readonly (string | undefined)[],
): Readonly<Record<string, string>> | null {
  const loaded = PC_BUILT_IN_ASSET_KEYS.every((_, index) => (labels[index] ?? '') !== '');
  return loaded
    ? Object.fromEntries(PC_BUILT_IN_ASSET_KEYS.map((key, index) => [key, labels[index] ?? '']))
    : null;
}

function builtInNames(key: PcBuiltInAssetKey): string[] {
  return [enAssetLabels[key], arAssetLabels[key]].map(fold);
}

/** Every name an asset is shown under, folded: its typed name, and for a built-in its label in
 * each locale. Two assets whose names meet would show the same name in some language. */
function namesOf(asset: Pick<PcAsset, 'key' | 'name' | 'group'>): Set<string> {
  const names = new Set<string>();
  if (asset.name.trim() !== '') {
    names.add(fold(asset.name));
  }
  const key = builtInKeyOf(asset);
  if (key !== undefined) {
    builtInNames(key).forEach((name) => names.add(name));
  }
  return names;
}

/** Whether an asset known by `names` (or standing for built-in `key`) would repeat one already in
 * the audit: the same built-in, or a name shown for both. Symmetric: whichever came first, in
 * whatever group. */
function clashes(
  assets: readonly PcAsset[],
  names: ReadonlySet<string>,
  key: PcBuiltInAssetKey | undefined,
): boolean {
  return assets.some(
    (asset) =>
      (key !== undefined && builtInKeyOf(asset) === key) ||
      [...namesOf(asset)].some((name) => names.has(name)),
  );
}

/** The suggested chips still to offer in `group`: its two built-ins, minus any the audit already
 * holds or whose label an asset of any group is already shown under. */
export function suggestedAssets(
  assets: readonly PcAsset[],
  group: PcBalanceGroup,
): PcBuiltInAssetKey[] {
  return PC_SUGGESTED_ASSETS[group].filter(
    (key) => !clashes(assets, new Set(builtInNames(key)), key),
  );
}

function newAsset(key: string, name: string, group: PcBalanceGroup): PcAsset {
  return { key, name, group, p: DEFAULT_SLIDER_VALUE, pc: DEFAULT_SLIDER_VALUE };
}

function groupOfBuiltIn(key: PcBuiltInAssetKey): PcBalanceGroup {
  return PC_BALANCE_GROUPS.find((candidate) =>
    (PC_SUGGESTED_ASSETS[candidate] as readonly string[]).includes(key),
  ) as PcBalanceGroup;
}

/** A suggested chip: appends the built-in asset `key` with both sliders at 3; a no-op copy if the
 * audit already holds it or an asset shown under its name. */
export function addBuiltInAsset(assets: readonly PcAsset[], key: PcBuiltInAssetKey): PcAsset[] {
  if (clashes(assets, new Set(builtInNames(key)), key)) {
    return [...assets];
  }
  return [...assets, newAsset(key, '', groupOfBuiltIn(key))];
}

export type AddNamedAssetResult =
  | { readonly ok: true; readonly assets: PcAsset[]; readonly key: string }
  | { readonly ok: false; readonly reason: 'blank' | 'duplicate' };

/** The group's free-text field: appends an asset named `name` (trimmed), or the built-in its
 * label stands for. Refused for a blank name, and for a name any asset of the audit is already
 * shown under, in either language, or the built-in it stands for (the same rule as a chip). */
export function addNamedAsset(
  assets: readonly PcAsset[],
  name: string,
  group: PcBalanceGroup,
): AddNamedAssetResult {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'blank' };
  }
  const key = builtInKeyForName(trimmed, group);
  const candidate =
    key === undefined ? { key: '', name: trimmed, group } : { key, name: '', group };
  if (clashes(assets, namesOf(candidate), key)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (key !== undefined) {
    return { ok: true, assets: [...assets, newAsset(key, '', group)], key };
  }
  const added = newAsset(crypto.randomUUID(), trimmed, group);
  return { ok: true, assets: [...assets, added], key: added.key };
}

/** Whether removing the asset loses something the user entered (so it is confirmed, with Undo):
 * a typed name, a rating or an action. A suggested asset nobody touched holds none. */
export function hasAssetData(asset: Pick<PcAsset, 'name' | 'p' | 'pc' | 'action'>): boolean {
  return (
    asset.name.trim() !== '' ||
    asset.p !== DEFAULT_SLIDER_VALUE ||
    asset.pc !== DEFAULT_SLIDER_VALUE ||
    (asset.action ?? '').trim() !== ''
  );
}

/** Undo of a removed asset: puts `asset` back at `index` (or the end, if the list got shorter).
 * If the audit meanwhile holds the same asset again (its key, the same built-in re-added from its
 * chip, or an asset shown under its name), that one is replaced by `asset` in place, so its
 * ratings come back without a second row. */
export function restoreAsset(assets: readonly PcAsset[], asset: PcAsset, index: number): PcAsset[] {
  const names = namesOf(asset);
  const key = builtInKeyOf(asset);
  const existing = assets.findIndex(
    (candidate) => candidate.key === asset.key || clashes([candidate], names, key),
  );
  if (existing !== -1) {
    return assets.map((candidate, at) => (at === existing ? asset : candidate));
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
