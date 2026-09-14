import { Routes } from '@angular/router';
import { buildRoutes } from './core/routing/build-routes';
import { ROUTE_REGISTRY } from './route-registry';

/** Generated from the feature registry. Do not add routes here; edit `route-registry.ts`. */
export const routes: Routes = buildRoutes(ROUTE_REGISTRY);
