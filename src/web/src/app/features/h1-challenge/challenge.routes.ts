import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { ChallengePage } from './challenge-page';

export default [
  {
    // One route with an optional `:itemId` (a past test), as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h1-challenge',
    // `h1-commitments`: "Promises due today" shows each promise's status in that exercise's words.
    providers: [
      provideTranslocoScope('h1-challenge'),
      provideTranslocoScope('exercise-kit'),
      provideTranslocoScope('h1-commitments'),
      ...provideLocaleDateAdapter(),
    ],
    component: ChallengePage,
  },
] satisfies Routes;
