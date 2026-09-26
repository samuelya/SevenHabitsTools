import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { LongViewPage } from './long-view-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h2-long-view',
    providers: [provideTranslocoScope('h2-long-view'), provideTranslocoScope('exercise-kit')],
    component: LongViewPage,
  },
] satisfies Routes;
