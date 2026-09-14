export interface NavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly icon: string;
  /** Only active on an exact URL match (Home). */
  readonly exact: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', labelKey: 'nav.home', icon: 'home', exact: true },
  { path: '/habits', labelKey: 'nav.habits', icon: 'checklist', exact: false },
  { path: '/plan', labelKey: 'nav.plan', icon: 'calendar_month', exact: false },
  { path: '/journal', labelKey: 'nav.journal', icon: 'edit_note', exact: false },
  { path: '/settings', labelKey: 'nav.settings', icon: 'settings', exact: false },
];
