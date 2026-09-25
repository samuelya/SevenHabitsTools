import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { RehearsalPage } from './rehearsal-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h1-rehearsal',
    // The date adapter: the "When" datepicker.
    providers: [
      provideTranslocoScope('h1-rehearsal'),
      provideTranslocoScope('exercise-kit'),
      ...provideLocaleDateAdapter(),
    ],
    component: RehearsalPage,
  },
] satisfies Routes;
