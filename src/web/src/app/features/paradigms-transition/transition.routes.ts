import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { TransitionPage } from './transition-page';

export default [
  {
    // One route, not a `''`/`':itemId'` sibling pair: the editor is still the child segment the
    // owner decided on (#184, option (b)) — back gesture, reload and deep link all work — but
    // opening and closing it is now a param change on the *same* route config, so the router
    // keeps the live `TransitionPage` instead of destroying and rebuilding it each time. See
    // `optionalParamMatcher`'s own doc comment for what the sibling pair silently cost.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.paradigms-transition',
    // The exercise's own scope, plus `exercise-kit` (playbook §2 gap fixed by this PR): every
    // exercise page that uses a kit component (`ExerciseList`, `ExercisePage`, `DoneToggle`,
    // `ExercisePromptCard`, ...) needs that scope provided here too, since those components read
    // their own generic-chrome strings from it (`exerciseKit.*`), not from the exercise's scope.
    providers: [
      provideTranslocoScope('paradigms-transition'),
      provideTranslocoScope('exercise-kit'),
    ],
    component: TransitionPage,
  },
] satisfies Routes;
