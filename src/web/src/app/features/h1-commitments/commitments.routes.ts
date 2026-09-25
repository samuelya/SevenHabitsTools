import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { CommitmentsPage } from './commitments-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h1-commitments',
    // `habits`: the source line and "From" filter show other exercises' short titles.
    providers: [
      provideTranslocoScope('h1-commitments'),
      provideTranslocoScope('exercise-kit'),
      provideTranslocoScope('habits'),
      ...provideLocaleDateAdapter(),
    ],
    component: CommitmentsPage,
  },
] satisfies Routes;
