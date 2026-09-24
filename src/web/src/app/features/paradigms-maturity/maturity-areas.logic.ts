import { area as arAreaLabels } from './i18n/ar.json';
import { area as enAreaLabels } from './i18n/en.json';
import { MATURITY_AREA_KEYS, MaturityArea, MaturityAreaKey } from './maturity.model';

/** Area names and the area picker (issue #222): which built-in an area stands for, the chips,
 * and adding or restoring an area. Pure; the form and the delta matching both read it. */

function fold(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** Every locale's label for each built-in key, folded. Read from the feature's own i18n files, so
 * a custom area typed in either language before #222 (the #230 placeholder suggested "e.g.
 * Friendships") is recognised whatever the current language is. Built on first use, not at module
 * load: `maturity.model.ts` imports this file through `maturity.logic.ts`, so
 * `MATURITY_AREA_KEYS` isn't initialised yet while this module first evaluates. */
let builtInKeyByName: ReadonlyMap<string, MaturityAreaKey> | null = null;

function builtInKeys(): ReadonlyMap<string, MaturityAreaKey> {
  builtInKeyByName ??= new Map(
    [enAreaLabels, arAreaLabels].flatMap((labels: Record<MaturityAreaKey, string>) =>
      MATURITY_AREA_KEYS.map((key) => [fold(labels[key]), key] as const),
    ),
  );
  return builtInKeyByName;
}

/** The built-in key whose label (in any locale) is `name`, compared trimmed and
 * case-insensitively; `undefined` for any other name. */
export function builtInKeyForName(name: string): MaturityAreaKey | undefined {
  return builtInKeys().get(fold(name));
}

/** The built-in an area stands for: its `key`, else a custom `name` equal to a built-in label, so
 * a custom "Friendships" and the built-in `friendships` are one area (#222 review). */
export function areaKeyOf(area: Pick<MaturityArea, 'key' | 'name'>): MaturityAreaKey | undefined {
  return area.key ?? (area.name === undefined ? undefined : builtInKeyForName(area.name));
}

/** Already-translated display name: a custom or renamed name if set, otherwise the built-in
 * area's translated label — never both, never neither (issue #50's implementation notes:
 * "Displayed name = name ?? t(key)"). */
export function displayName(
  area: Pick<MaturityArea, 'key' | 'name'>,
  builtInLabels: Readonly<Record<string, string>>,
): string {
  return area.name ?? (area.key ? (builtInLabels[area.key] ?? '') : '');
}

/** Whether removing the area loses something the user entered: a level or a non-blank note. */
export function hasAreaData(area: Pick<MaturityArea, 'level' | 'note'>): boolean {
  return area.level !== undefined || (area.note ?? '').trim() !== '';
}

/** One chip of phase 1, "Which areas do you want to rate?" (issue #222). A suggested built-in has
 * one chip whatever it holds (`id` `key:<key>`, so pressing it keeps the same button and focus),
 * pressed with the `areaId` of the area standing for it. Any other area (a custom name, a second
 * area for the same key, or a built-in no longer suggested such as `community`) gets its own
 * pressed chip, so an existing assessment shows every area it holds. */
export interface AreaChip {
  readonly id: string;
  readonly label: string;
  readonly pressed: boolean;
  /** Set on a suggested built-in's chip: what pressing it adds. */
  readonly key?: MaturityAreaKey;
  /** Set on a pressed chip: the one area unpressing it removes. */
  readonly areaId?: string;
}

export function areaChips(
  areas: readonly MaturityArea[],
  suggested: readonly MaturityAreaKey[],
  builtInLabels: Readonly<Record<string, string>>,
): AreaChip[] {
  const shown = new Set<string>();
  const builtIn = suggested.map((key): AreaChip => {
    const area = areas.find((candidate) => areaKeyOf(candidate) === key);
    if (!area) {
      return { id: `key:${key}`, key, label: builtInLabels[key] ?? '', pressed: false };
    }
    shown.add(area.id);
    // The stored name when it has one: a renamed built-in (#50) or a custom "Friendships".
    return {
      id: `key:${key}`,
      key,
      areaId: area.id,
      label: displayName(area, builtInLabels),
      pressed: true,
    };
  });
  const others = areas
    .filter((area) => !shown.has(area.id))
    .map((area): AreaChip => ({
      id: area.id,
      areaId: area.id,
      label: displayName(area, builtInLabels),
      pressed: true,
    }));
  return [...builtIn, ...others];
}

/** Pressing an unpressed built-in chip: appends a new unrated area with that key. */
export function addBuiltInArea(
  areas: readonly MaturityArea[],
  key: MaturityAreaKey,
): MaturityArea[] {
  return [...areas, { id: crypto.randomUUID(), key }];
}

export type AddCustomAreaResult =
  | { readonly ok: true; readonly areas: MaturityArea[] }
  | { readonly ok: false; readonly reason: 'blank' | 'duplicate' };

/** "Add your own": appends an unrated custom area storing the trimmed `name`. A built-in's label
 * in any locale adds that built-in instead (`addBuiltInArea`), so a no-longer-suggested built-in
 * such as Community can be added back (#222 re-review R1). Refused for a blank name, and for a
 * name already in the list: an area's displayed name, or the built-in an area stands for,
 * compared case-insensitively (#222 review). */
export function addCustomArea(
  areas: readonly MaturityArea[],
  name: string,
  builtInLabels: Readonly<Record<string, string>>,
): AddCustomAreaResult {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'blank' };
  }
  const folded = fold(trimmed);
  const key = builtInKeyForName(trimmed);
  if (
    areas.some(
      (area) =>
        fold(displayName(area, builtInLabels)) === folded ||
        (key !== undefined && areaKeyOf(area) === key),
    )
  ) {
    return { ok: false, reason: 'duplicate' };
  }
  if (key !== undefined) {
    return { ok: true, areas: addBuiltInArea(areas, key) };
  }
  return { ok: true, areas: [...areas, { id: crypto.randomUUID(), name: trimmed }] };
}

/** Undo of a removed area: puts `area` back at `index` (or the end, if the list got shorter); a
 * no-op copy if an area with its id is already there. */
export function restoreArea(
  areas: readonly MaturityArea[],
  area: MaturityArea,
  index: number,
): MaturityArea[] {
  if (areas.some((candidate) => candidate.id === area.id)) {
    return [...areas];
  }
  const at = Math.max(0, Math.min(index, areas.length));
  return [...areas.slice(0, at), area, ...areas.slice(at)];
}
