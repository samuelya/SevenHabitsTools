import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { LanguagePage } from './language-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h1-language',
    providers: [provideTranslocoScope('h1-language'), provideTranslocoScope('exercise-kit')],
    component: LanguagePage,
  },
] satisfies Routes;
