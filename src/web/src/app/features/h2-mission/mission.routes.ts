import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { MissionPage } from './mission-page';

export default [
  {
    // A worksheet: one plain route, no selection param (as `perception.routes.ts`).
    path: '',
    title: 'titles.h2-mission',
    // `exercise-kit`: the kit's chrome and the built-in role's label (`exerciseKit.roles.*`).
    providers: [provideTranslocoScope('h2-mission'), provideTranslocoScope('exercise-kit')],
    component: MissionPage,
  },
] satisfies Routes;
