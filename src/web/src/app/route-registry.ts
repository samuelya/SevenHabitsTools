import { FeatureRoute } from './core/routing/feature-route';

/**
 * Feature registry: one line per feature. Feature PRs add their line here and never edit
 * `app.routes.ts`. Exercises set `hub` to appear on their habit hub page, e.g.
 * `{ path: 'habits/h2/mission', loadChildren: () => import('./features/mission/mission.routes'), hub: { habit: 'h2', titleKey: 'mission.title', icon: 'flag' } },`
 */
export const ROUTE_REGISTRY: readonly FeatureRoute[] = [
  { path: '', loadChildren: () => import('./features/home/home.routes') },
  { path: 'habits', loadChildren: () => import('./features/habits/habits.routes') },
  { path: 'plan', loadChildren: () => import('./features/plan/plan.routes') },
  { path: 'journal', loadChildren: () => import('./features/journal/journal.routes') },
  { path: 'settings', loadChildren: () => import('./features/settings/settings.routes') },
  { path: 'about', loadChildren: () => import('./features/about/about.routes') },
];
