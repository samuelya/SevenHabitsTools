import { InjectionToken } from '@angular/core';
import { LoadChildren } from '@angular/router';

/** One line in `app/route-registry.ts`, contributed by a feature. */
export interface FeatureRoute {
  /** URL path relative to the app root, without leading or trailing slash. */
  readonly path: string;
  readonly loadChildren: LoadChildren;
}

/** The registered features, provided in `app.config.ts`. */
export const FEATURE_ROUTES = new InjectionToken<readonly FeatureRoute[]>('FEATURE_ROUTES');
