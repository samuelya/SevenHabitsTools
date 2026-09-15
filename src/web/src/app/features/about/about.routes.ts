import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AboutPage } from './about-page';

export default [
  {
    path: '',
    title: 'about.title',
    // The title key's scope — `AppTitleStrategy` needs this alongside `provideTranslocoScope()`
    // above; see its doc comment.
    data: { titleScope: 'about' },
    component: AboutPage,
    providers: [provideTranslocoScope('about')],
  },
] satisfies Routes;
