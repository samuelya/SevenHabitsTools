import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { DevKitPage } from './dev-kit-page';

/** Non-production-only demo route (`route-registry.ts` gates it on `isDevMode()`) showing every
 * `shared/exercise-kit/` component composed together. */
export default [
  {
    path: '',
    title: 'titles.devKit',
    component: DevKitPage,
    providers: [provideTranslocoScope('exercise-kit')],
  },
] satisfies Routes;
