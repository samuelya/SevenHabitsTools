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
  {
    path: 'habits/paradigms/transition',
    loadChildren: () => import('./features/paradigms-transition/transition.routes'),
  },
  {
    path: 'habits/paradigms/pc-balance',
    loadChildren: () => import('./features/paradigms-pc-balance/pc-balance.routes'),
  },
  {
    path: 'habits/paradigms/maturity',
    loadChildren: () => import('./features/paradigms-maturity/maturity.routes'),
  },
  {
    path: 'habits/paradigms/teach',
    loadChildren: () => import('./features/paradigms-teach/teach.routes'),
  },
  {
    path: 'habits/paradigms/perception',
    loadChildren: () => import('./features/paradigms-perception/perception.routes'),
  },
  {
    path: 'habits/h1/rehearsal',
    loadChildren: () => import('./features/h1-rehearsal/rehearsal.routes'),
  },
  {
    path: 'habits/h1/circle',
    loadChildren: () => import('./features/h1-circle/circle.routes'),
  },
  {
    path: 'habits/h1/challenge',
    loadChildren: () => import('./features/h1-challenge/challenge.routes'),
  },
  {
    path: 'habits/h1/language',
    loadChildren: () => import('./features/h1-language/language.routes'),
  },
  {
    path: 'habits/h1/commitments',
    loadChildren: () => import('./features/h1-commitments/commitments.routes'),
  },
  {
    path: 'habits/h2/roles',
    loadChildren: () => import('./features/h2-roles/roles.routes'),
  },
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
