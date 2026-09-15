import { CanMatchFn, ResolveFn, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { findHabit, isHabitId } from '../../core/habits/habits';
import { HabitHubPage } from './habit-hub-page';
import { HabitsPage } from './habits-page';

/** Only known habit ids match; anything else falls through to the not-found redirect. */
export const habitIdMatch: CanMatchFn = (_route, segments) => isHabitId(segments[0]?.path);

export const habitTitle: ResolveFn<string> = (route) =>
  findHabit(route.paramMap.get('habit'))?.titleKey ?? '';

export default [
  {
    path: '',
    providers: [provideTranslocoScope('habits')],
    children: [
      { path: '', pathMatch: 'full', title: 'nav.habits', component: HabitsPage },
      {
        path: ':habit',
        canMatch: [habitIdMatch],
        title: habitTitle,
        // habitTitle resolves to a 'habits.<id>.title' key — see about.routes.ts's data.titleScope.
        data: { titleScope: 'habits' },
        component: HabitHubPage,
      },
    ],
  },
] satisfies Routes;
