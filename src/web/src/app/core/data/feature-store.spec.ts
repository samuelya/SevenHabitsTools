import { TestBed } from '@angular/core/testing';
import { featureStore } from './feature-store';
import {
  ModelRegistration,
  registerModel,
  resetRegistryForTesting,
  snapshotRegistryForTesting,
} from './registry';

interface Mission {
  statement: string;
}

describe('featureStore', () => {
  // See registry.spec.ts: restore exactly what was registered before this test, not an empty
  // registry — real `<feature>.model.ts` files register themselves once, as a side effect of
  // being imported, and won't do so again.
  let baseline: ReadonlyMap<string, ModelRegistration>;
  beforeEach(() => {
    baseline = snapshotRegistryForTesting();
  });
  afterEach(() => resetRegistryForTesting(baseline));

  it('throws for a key nobody registered', () => {
    expect(() =>
      TestBed.runInInjectionContext(() => featureStore<Mission>('missing')),
    ).toThrowError(/No model registered/);
  });

  it('reads the model defaults before anything is stored, and the stored value after', () => {
    registerModel<Mission>({
      key: 'mission',
      path: 'habits.h2.mission',
      defaults: () => ({ statement: '' }),
    });

    const mission = TestBed.runInInjectionContext(() => featureStore<Mission>('mission'));
    expect(mission.value()).toEqual({ statement: '' });

    mission.update(() => ({ statement: 'Be the change' }));

    expect(mission.value()).toEqual({ statement: 'Be the change' });
  });

  it('falls back to defaults inside update() when nothing is stored yet', () => {
    registerModel<Mission>({
      key: 'mission',
      path: 'habits.h2.mission',
      defaults: () => ({ statement: 'default' }),
    });

    const mission = TestBed.runInInjectionContext(() => featureStore<Mission>('mission'));
    mission.update((current) => ({ statement: `${current.statement}!` }));

    expect(mission.value()).toEqual({ statement: 'default!' });
  });
});
