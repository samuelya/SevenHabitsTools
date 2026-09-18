import {
  getRegisteredHubActions,
  registerHubAction,
  resetHubActionRegistryForTesting,
  snapshotHubActionRegistryForTesting,
} from './hub-action-registry';

describe('hub-action-registry', () => {
  let snapshot: ReturnType<typeof snapshotHubActionRegistryForTesting>;

  beforeEach(() => {
    snapshot = snapshotHubActionRegistryForTesting();
    resetHubActionRegistryForTesting();
  });

  afterEach(() => resetHubActionRegistryForTesting(snapshot));

  it('returns registered hub actions in registration order', () => {
    registerHubAction({
      id: 'a',
      labelKey: 'a.label',
      icon: 'a-icon',
      route: 'habits/a',
    });
    registerHubAction({
      id: 'b',
      labelKey: 'b.label',
      icon: 'b-icon',
      route: 'habits/b',
    });

    expect(getRegisteredHubActions().map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('throws when the same id is registered twice', () => {
    registerHubAction({ id: 'a', labelKey: 'a.label', icon: 'a-icon', route: 'habits/a' });

    expect(() =>
      registerHubAction({ id: 'a', labelKey: 'other', icon: 'other', route: 'other' }),
    ).toThrow('"a"');
  });

  it('builds query params from the habit shown on', () => {
    registerHubAction({
      id: 'a',
      labelKey: 'a.label',
      icon: 'a-icon',
      route: 'habits/a',
      queryParams: (habit) => ({ chapter: habit }),
    });

    expect(getRegisteredHubActions()[0].queryParams?.('h3')).toEqual({ chapter: 'h3' });
  });
});
