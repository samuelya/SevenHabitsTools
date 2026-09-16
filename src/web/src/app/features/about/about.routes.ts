import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AboutPage } from './about-page';

export default [
  {
    path: '',
    // A root/shell-scope key, not the 'about' feature scope's own 'title' key (used by the page's
    // own <h1>) — see habits.routes.ts's habitTitle doc comment (#149).
    title: 'titles.about',
    component: AboutPage,
    providers: [provideTranslocoScope('about')],
  },
] satisfies Routes;
