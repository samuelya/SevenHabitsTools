import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { ProjectsPage } from './projects-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h2-projects',
    providers: [
      provideTranslocoScope('h2-projects'),
      provideTranslocoScope('exercise-kit'),
      ...provideLocaleDateAdapter(),
    ],
    component: ProjectsPage,
  },
] satisfies Routes;
