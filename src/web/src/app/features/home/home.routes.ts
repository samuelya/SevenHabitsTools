import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { HomePage } from './home-page';

export default [
  {
    path: '',
    pathMatch: 'full',
    title: 'titles.home',
    component: HomePage,
    // `habits`: exercise and habit short titles, progress counts and statuses are keys in that
    // scope (the registry's contract, `exercise-registry.ts`).
    providers: [provideTranslocoScope('home'), provideTranslocoScope('habits')],
  },
] satisfies Routes;
