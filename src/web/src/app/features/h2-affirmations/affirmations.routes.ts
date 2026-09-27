import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { AffirmationsPage } from './affirmations-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h2-affirmations',
    providers: [provideTranslocoScope('h2-affirmations'), provideTranslocoScope('exercise-kit')],
    component: AffirmationsPage,
  },
] satisfies Routes;
