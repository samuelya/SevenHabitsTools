import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { RolesPage } from './roles-page';

export default [
  {
    // One route with an optional `:itemId`, as `transition.routes.ts` explains.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.h2-roles',
    // `exercise-kit`: the kit's chrome and the built-in role's label (`exerciseKit.roles.*`).
    providers: [provideTranslocoScope('h2-roles'), provideTranslocoScope('exercise-kit')],
    component: RolesPage,
  },
] satisfies Routes;
