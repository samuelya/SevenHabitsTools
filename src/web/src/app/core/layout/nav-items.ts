export interface NavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly icon: string;
  /** Only active on an exact URL match (Home). */
  readonly exact: boolean;
}

/** Every main-nav destination, in display order. Only the ones whose feature has called
 * `registerNavFeature()` are shown (`visibleNavItems()`), so a destination that hasn't shipped
 * yet (Plan, Journal) stays out of the nav while its route still resolves for deep links
 * (issue #221). */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', labelKey: 'nav.home', icon: 'home', exact: true },
  { path: '/habits', labelKey: 'nav.habits', icon: 'checklist', exact: false },
  { path: '/plan', labelKey: 'nav.plan', icon: 'calendar_month', exact: false },
  { path: '/journal', labelKey: 'nav.journal', icon: 'edit_note', exact: false },
  { path: '/settings', labelKey: 'nav.settings', icon: 'settings', exact: false },
];

const registered = new Set<string>();

/** Marks the `NAV_ITEMS` entry with this `path` as shipped, so it appears in the main nav. Called
 * once per feature from `app/nav-registry.ts`; registering the same path twice is a no-op. */
export function registerNavFeature(path: string): void {
  if (!NAV_ITEMS.some((item) => item.path === path)) {
    throw new Error(`No nav item with path "${path}"`);
  }
  registered.add(path);
}

/** The registered nav paths. */
export function getRegisteredNavFeatures(): ReadonlySet<string> {
  return new Set(registered);
}

/** `items` whose feature is registered, in their original order. */
export function visibleNavItems(
  items: readonly NavItem[],
  registeredPaths: ReadonlySet<string>,
): readonly NavItem[] {
  return items.filter((item) => registeredPaths.has(item.path));
}

/** Test-only: see `snapshotRegistryForTesting()` in `core/data/registry.ts` — same purpose, for
 * this registry. */
export function snapshotNavRegistryForTesting(): ReadonlySet<string> {
  return new Set(registered);
}

/** Test-only: clears the registry, then restores `snapshot` if given. */
export function resetNavRegistryForTesting(snapshot?: ReadonlySet<string>): void {
  registered.clear();
  for (const path of snapshot ?? []) {
    registered.add(path);
  }
}
