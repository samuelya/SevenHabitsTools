import { Routes } from '@angular/router';
import { buildRoutes } from './core/routing/build-routes';
import { ROUTE_REGISTRY } from './route-registry';

describe('ROUTE_REGISTRY', () => {
  it('builds a valid router configuration', () => {
    expect(() => buildRoutes(ROUTE_REGISTRY)).not.toThrow();
  });

  it('registers home and every top-level navigation destination', () => {
    expect(ROUTE_REGISTRY.map((feature) => feature.path)).toEqual(
      expect.arrayContaining(['', 'habits', 'plan', 'journal', 'settings']),
    );
  });

  it.each(ROUTE_REGISTRY.map((feature) => [feature.path || '(home)', feature] as const))(
    'lazy loads routes for %s',
    async (_name, feature) => {
      const loaded = await (feature.loadChildren as () => Promise<Routes | { default: Routes }>)();
      const routes = 'default' in loaded ? loaded.default : loaded;
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThan(0);
    },
  );
});
