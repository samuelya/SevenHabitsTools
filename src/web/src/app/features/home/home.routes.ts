import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { HomePage } from './home-page';

export default [
  {
    path: '',
    pathMatch: 'full',
    title: 'titles.home',
    component: HomePage,
    providers: [provideTranslocoScope('home')],
  },
] satisfies Routes;
