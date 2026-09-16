import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { SettingsPage } from './settings-page';

export default [
  {
    path: '',
    title: 'titles.settings',
    component: SettingsPage,
    providers: [provideTranslocoScope('settings')],
  },
] satisfies Routes;
