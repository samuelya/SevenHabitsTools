import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { CirclePage } from './circle-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h1-circle',
    // The date adapter: the first step's "By when" datepicker.
    providers: [
      provideTranslocoScope('h1-circle'),
      provideTranslocoScope('exercise-kit'),
      ...provideLocaleDateAdapter(),
    ],
    component: CirclePage,
  },
] satisfies Routes;
