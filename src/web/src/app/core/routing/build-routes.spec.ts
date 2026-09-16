import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { buildRoutes } from './build-routes';
import { FeatureRoute } from './feature-route';

@Component({ template: 'stub', changeDetection: ChangeDetectionStrategy.OnPush })
class Stub {}

const childRoutes = (): Promise<Routes> => Promise.resolve([{ path: '', component: Stub }]);

describe('buildRoutes', () => {
  it('orders deeper paths first, home last and appends a wildcard redirect', () => {
    const routes = buildRoutes([
      { path: '', loadChildren: childRoutes },
      { path: 'habits', loadChildren: childRoutes },
      { path: 'habits/h2/mission', loadChildren: childRoutes },
      { path: 'plan', loadChildren: childRoutes },
    ]);

    expect(routes.map((route) => route.path)).toEqual([
      'habits/h2/mission',
      'habits',
      'plan',
      '',
      '**',
    ]);
    expect(routes.at(-1)?.redirectTo).toBe('');
  });

  it('rejects duplicate paths', () => {
    expect(() =>
      buildRoutes([
        { path: 'plan', loadChildren: childRoutes },
        { path: 'plan', loadChildren: childRoutes },
      ]),
    ).toThrowError(/Duplicate feature route path "plan"/);
  });

  it.each(['/plan', 'plan/', 'Plan', 'plan//week', 'plan week'])(
    'rejects invalid path "%s"',
    (path) => {
      expect(() => buildRoutes([{ path, loadChildren: childRoutes }])).toThrowError(/Invalid/);
    },
  );

  it('routes deep feature paths past a shorter prefix feature and redirects unknown URLs home', async () => {
    const loaded: string[] = [];
    const track = (name: string) => (): Promise<Routes> => {
      loaded.push(name);
      return Promise.resolve([{ path: '', pathMatch: 'full', component: Stub, data: { name } }]);
    };
    const registry: FeatureRoute[] = [
      { path: '', loadChildren: track('home') },
      { path: 'habits', loadChildren: track('habits') },
      { path: 'habits/h2/mission', loadChildren: track('mission') },
    ];
    TestBed.configureTestingModule({ providers: [provideRouter(buildRoutes(registry))] });
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/habits/h2/mission');
    expect(router.url).toBe('/habits/h2/mission');
    expect(loaded).toContain('mission');

    await harness.navigateByUrl('/does-not-exist');
    expect(router.url).toBe('/');
  });
});
