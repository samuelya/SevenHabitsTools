import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { MaturityPage } from './maturity-page';

export default [
  {
    // One route, not a `''`/`':itemId'` sibling pair — see `optionalParamMatcher`'s own doc
    // comment and the playbook's "Page layout" section for why (issue #187).
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.paradigms-maturity',
    providers: [provideTranslocoScope('paradigms-maturity'), provideTranslocoScope('exercise-kit')],
    component: MaturityPage,
  },
] satisfies Routes;
