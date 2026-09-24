import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { buildRoutes } from '../../core/routing/build-routes';
import { ROUTE_REGISTRY } from '../../route-registry';
import {
  getRegisteredExercises,
  registerExercise,
  resetExerciseRegistryForTesting,
  snapshotExerciseRegistryForTesting,
} from './exercise-registry';

/** Proves `registerExercise()`'s `route` actually resolves through the app's router config
 * (`ROUTE_REGISTRY`, the same one `app.routes.ts` builds from), so a typo'd or stale route fails a
 * test instead of silently 404ing to the wildcard redirect once the habit hub page links to it.
 * Navigates with a bare `Router`, not `RouterTestingHarness` — no `<router-outlet>` is mounted, so
 * routing resolves (matching, `canMatch` guards, redirects) without constructing the destination
 * page component or its services. */
describe('registered exercise routes', () => {
  let snapshot: ReturnType<typeof snapshotExerciseRegistryForTesting>;

  beforeEach(() => {
    snapshot = snapshotExerciseRegistryForTesting();
    resetExerciseRegistryForTesting();
    TestBed.configureTestingModule({
      providers: [provideRouter(buildRoutes(ROUTE_REGISTRY))],
    });
  });

  afterEach(() => {
    resetExerciseRegistryForTesting(snapshot);
  });

  it('resolves a registered exercise route to the route it names, not the wildcard redirect', async () => {
    registerExercise({
      exerciseId: 'fixture-real',
      habit: 'h1',
      titleKey: 'fixture.title',
      shortTitleKey: 'fixture.shortTitle',
      summaryKey: 'fixture.summary',
      icon: 'flag',
      route: 'habits/h1',
    });
    const router = TestBed.inject(Router);

    for (const entry of getRegisteredExercises()) {
      await router.navigateByUrl('/' + entry.route);
      expect(router.url).toBe('/' + entry.route);
    }
  });

  it("fails when a registered route is stale or typo'd and does not resolve", async () => {
    registerExercise({
      exerciseId: 'fixture-stale',
      habit: 'h1',
      titleKey: 'fixture.title',
      shortTitleKey: 'fixture.shortTitle',
      summaryKey: 'fixture.summary',
      icon: 'flag',
      route: 'habits/not-a-real-habit',
    });
    const router = TestBed.inject(Router);
    const [entry] = getRegisteredExercises();

    await router.navigateByUrl('/' + entry.route);

    expect(router.url).not.toBe('/' + entry.route);
    expect(router.url).toBe('/');
  });
});
