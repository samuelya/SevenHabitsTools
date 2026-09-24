import { CanMatchFn, ResolveFn, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { findHabit, isHabitId } from '../../core/habits/habits';
import { HabitHubPage } from './habit-hub-page';
import { HabitsPage } from './habits-page';

/** Only known habit ids match; anything else falls through to the not-found redirect. */
export const habitIdMatch: CanMatchFn = (_route, segments) => isHabitId(segments[0]?.path);

/**
 * The route *title* — unlike the hub page's own `<h1>` (`definition.titleKey`, the `habits`
 * feature scope) — resolves to a root/shell-scope `titles.<id>` key. Route and page titles are a
 * shell concern (the tab, the app bar), read by shell-level code (`AppTitleStrategy`,
 * `Shell.pageTitle`) that runs outside the feature's scoped injector, often before that scope has
 * loaded; a title living in a lazy feature scope structurally can't resolve reliably there (#149).
 */
export const habitTitle: ResolveFn<string> = (route) => {
  const habit = findHabit(route.paramMap.get('habit'));
  return habit ? `titles.${habit.id}` : '';
};

export default [
  {
    path: '',
    // `exercise-kit`: the hub's "About this habit" reuses the exercise guide dialog (#219), which
    // reads its close label from that scope through the hub's own view container.
    providers: [provideTranslocoScope('habits'), provideTranslocoScope('exercise-kit')],
    children: [
      { path: '', pathMatch: 'full', title: 'titles.habits', component: HabitsPage },
      { path: ':habit', canMatch: [habitIdMatch], title: habitTitle, component: HabitHubPage },
    ],
  },
] satisfies Routes;
