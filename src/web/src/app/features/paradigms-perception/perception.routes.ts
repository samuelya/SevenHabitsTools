import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { PerceptionPage } from './perception-page';

export default [
  {
    // A worksheet has no focus-mode editor and no selection param (playbook §5's "Worksheet
    // pages" note) — one plain route is enough, unlike a list/assessment's `optionalParamMatcher`.
    path: '',
    title: 'titles.paradigms-perception',
    // The exercise's own scope, plus `exercise-kit` (playbook §2): this page uses
    // `ExercisePage`, `ExercisePromptCard`, `ReflectionEditor`, `DoneToggle` and `GuidedStepper`,
    // all of which read their own generic-chrome strings from `exercise-kit`, not this scope.
    providers: [
      provideTranslocoScope('paradigms-perception'),
      provideTranslocoScope('exercise-kit'),
    ],
    component: PerceptionPage,
  },
] satisfies Routes;
