import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AboutPage } from './about-page';

export default [
  {
    path: '',
    title: 'about.title',
    component: AboutPage,
    providers: [provideTranslocoScope('about')],
  },
] satisfies Routes;
