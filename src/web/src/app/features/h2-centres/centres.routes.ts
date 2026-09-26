import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { CentresPage } from './centres-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h2-centres',
    providers: [provideTranslocoScope('h2-centres'), provideTranslocoScope('exercise-kit')],
    component: CentresPage,
  },
] satisfies Routes;
