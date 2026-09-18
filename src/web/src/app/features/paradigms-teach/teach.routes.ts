import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { optionalParamMatcher } from '../../core/routing/optional-param-matcher';
import { TeachPage } from './teach-page';

export default [
  {
    // One route, not a `''`/`':itemId'` sibling pair — see `optionalParamMatcher`'s own doc
    // comment, and the playbook's "Page layout" section, for why: it's what keeps this page's
    // instance (and the kit's focus-restore state) alive across opening and closing the editor.
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.paradigms-teach',
    // The exercise's own scope, plus `exercise-kit` (playbook §2): every exercise page that uses
    // a kit component (`ExerciseList`, `ExercisePage`, `DoneToggle`, `ExercisePromptCard`, ...)
    // needs that scope provided here too, since those components read their own generic-chrome
    // strings from it (`exerciseKit.*`), not from the exercise's scope.
    providers: [provideTranslocoScope('paradigms-teach'), provideTranslocoScope('exercise-kit')],
    component: TeachPage,
  },
] satisfies Routes;
