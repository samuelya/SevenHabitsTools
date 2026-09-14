import { Routes } from '@angular/router';
import { HabitId } from '../habits/habits';
import { FeatureRoute, HubLink } from './feature-route';

const VALID_PATH = /^$|^[a-z0-9-]+(\/[a-z0-9-]+)*$/;

/** Turns the feature registry into the router configuration. */
export function buildRoutes(registry: readonly FeatureRoute[]): Routes {
  const seen = new Set<string>();
  for (const { path } of registry) {
    if (!VALID_PATH.test(path)) {
      throw new Error(`Invalid feature route path "${path}"`);
    }
    if (seen.has(path)) {
      throw new Error(`Duplicate feature route path "${path}"`);
    }
    seen.add(path);
  }

  // Longer paths first so a feature such as `habits/h2/mission` wins over the `habits` prefix;
  // the empty (home) path goes last.
  const ordered = [...registry].sort(
    (a, b) => segmentCount(b.path) - segmentCount(a.path) || a.path.localeCompare(b.path),
  );

  return [
    ...ordered.map(({ path, loadChildren }) => ({ path, loadChildren })),
    { path: '**', redirectTo: '' },
  ];
}

/** Hub entries contributed to a habit, in registry order. */
export function hubEntriesFor(registry: readonly FeatureRoute[], habit: HabitId): HubLink[] {
  return registry.flatMap((feature) =>
    feature.hub?.habit === habit ? [{ ...feature.hub, path: feature.path }] : [],
  );
}

function segmentCount(path: string): number {
  return path === '' ? 0 : path.split('/').length;
}
