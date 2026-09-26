import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { InspirationPage } from './inspiration-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h2-inspiration',
    providers: [provideTranslocoScope('h2-inspiration'), provideTranslocoScope('exercise-kit')],
    component: InspirationPage,
  },
] satisfies Routes;
