import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { TransitionPage } from './transition-page';

export default [
  {
    path: '',
    // The exercise's own scope, plus `exercise-kit` (playbook §2 gap fixed by this PR): every
    // exercise page that uses a kit component (`ExerciseList`, `ExercisePage`, `DoneToggle`,
    // `ExercisePromptCard`, ...) needs that scope provided here too, since those components read
    // their own generic-chrome strings from it (`exerciseKit.*`), not from the exercise's scope.
    providers: [
      provideTranslocoScope('paradigms-transition'),
      provideTranslocoScope('exercise-kit'),
    ],
    // Two siblings sharing one `TransitionPage` instance-per-match, not one route with an
    // optional param: the mobile editor is the child route `:itemId` (owner decision on #184,
    // option (b)) so the phone's back gesture closes it, a reload with `:itemId` in the URL
    // reopens it, and `TransitionPage` redirects `../` on an id that isn't a live script's (see
    // its own doc comment). `TransitionPage.itemId` binds to the `:itemId` param through
    // `withComponentInputBinding()` (`app.config.ts`) — absent (and so defaulting to `null`) on
    // the plain '' match, exactly like `HabitHubPage.habit` binds `:habit` (`habits.routes.ts`).
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'titles.paradigms-transition',
        component: TransitionPage,
      },
      { path: ':itemId', title: 'titles.paradigms-transition', component: TransitionPage },
    ],
  },
] satisfies Routes;
