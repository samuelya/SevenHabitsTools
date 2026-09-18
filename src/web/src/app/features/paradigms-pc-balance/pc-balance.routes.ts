import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { PcBalancePage } from './pc-balance-page';

export default [
  {
    // One route, not a `''`/`':itemId'` sibling pair — see `optionalParamMatcher`'s own doc
    // comment and the playbook's "Page layout" section for why (issue #187).
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.paradigms-pc-balance',
    providers: [
      provideTranslocoScope('paradigms-pc-balance'),
      provideTranslocoScope('exercise-kit'),
    ],
    component: PcBalancePage,
  },
] satisfies Routes;
