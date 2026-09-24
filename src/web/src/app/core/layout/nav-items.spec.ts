import {
  NAV_ITEMS,
  NavItem,
  registerNavFeature,
  resetNavRegistryForTesting,
  snapshotNavRegistryForTesting,
  visibleNavItems,
  getRegisteredNavFeatures,
} from './nav-items';

describe('visibleNavItems', () => {
  it('keeps only the registered items, in their original order', () => {
    const paths = visibleNavItems(NAV_ITEMS, new Set(['/settings', '/', '/habits'])).map(
      (item: NavItem) => item.path,
    );
    expect(paths).toEqual(['/', '/habits', '/settings']);
  });

  it('shows nothing when nothing is registered', () => {
    expect(visibleNavItems(NAV_ITEMS, new Set())).toEqual([]);
  });
});

describe('registerNavFeature', () => {
  let snapshot: ReadonlySet<string>;
  beforeEach(() => {
    snapshot = snapshotNavRegistryForTesting();
    resetNavRegistryForTesting();
  });
  afterEach(() => resetNavRegistryForTesting(snapshot));

  it('adds a known nav path once, however often it is registered', () => {
    registerNavFeature('/plan');
    registerNavFeature('/plan');
    expect([...getRegisteredNavFeatures()]).toEqual(['/plan']);
  });

  it('rejects a path with no nav item', () => {
    expect(() => registerNavFeature('/nowhere')).toThrowError(/No nav item/);
  });
});

describe('app nav registry', () => {
  it('lists Home, Habits and Settings; Plan and Journal wait until they ship (#221)', async () => {
    await import('../../nav-registry');
    expect(visibleNavItems(NAV_ITEMS, getRegisteredNavFeatures()).map((item) => item.path)).toEqual(
      ['/', '/habits', '/settings'],
    );
  });
});
