import { Routes } from '@angular/router';
import { HomePage } from './home-page';

export default [
  { path: '', pathMatch: 'full', title: 'nav.home', component: HomePage },
] satisfies Routes;
