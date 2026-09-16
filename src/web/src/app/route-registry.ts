import { isDevMode } from '@angular/core';
import { FeatureRoute } from './core/routing/feature-route';

/**
 * Feature registry: one line per feature. Feature PRs add their line here and never edit
 * `app.routes.ts`. An exercise feature also calls `registerExercise()`
 * (`shared/exercise-kit/exercise-registry.ts`) with a matching `route`, which is what makes it
 * appear on its habit hub page (issue #31).
 */
export const ROUTE_REGISTRY: readonly FeatureRoute[] = [
  { path: '', loadChildren: () => import('./features/home/home.routes') },
  { path: 'habits', loadChildren: () => import('./features/habits/habits.routes') },
  { path: 'plan', loadChildren: () => import('./features/plan/plan.routes') },
  { path: 'journal', loadChildren: () => import('./features/journal/journal.routes') },
  { path: 'settings', loadChildren: () => import('./features/settings/settings.routes') },
  { path: 'about', loadChildren: () => import('./features/about/about.routes') },
  // Demo route for `shared/exercise-kit/` (issue #30) — never registered in a production build.
  ...(isDevMode()
    ? [
        {
          path: 'dev/kit',
          loadChildren: () => import('./shared/exercise-kit/dev-kit/dev-kit.routes'),
        },
      ]
    : []),
];
