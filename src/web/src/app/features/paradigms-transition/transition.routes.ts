import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { TransitionPage } from './transition-page';

export default [
  {
    path: '',
    title: 'titles.paradigms-transition',
    component: TransitionPage,
    // The exercise's own scope, plus `exercise-kit` (playbook §2 gap fixed by this PR): every
    // exercise page that uses a kit component (`ExerciseList`, `ExerciseDetail`, `DoneToggle`,
    // `ExercisePromptCard`, ...) needs that scope provided here too, since those components read
    // their own generic-chrome strings from it (`exerciseKit.*`), not from the exercise's scope.
    providers: [
      provideTranslocoScope('paradigms-transition'),
      provideTranslocoScope('exercise-kit'),
    ],
  },
] satisfies Routes;
