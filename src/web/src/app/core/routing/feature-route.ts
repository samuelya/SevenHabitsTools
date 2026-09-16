import { InjectionToken } from '@angular/core';
import { LoadChildren } from '@angular/router';
import { HabitId } from '../habits/habits';

/** Unused as of issue #31: the habit hub page lists exercises from
 * `shared/exercise-kit/exercise-registry.ts` directly, not from this. Kept for `hubEntriesFor()`
 * and its test coverage below; a future feature does not need to set `FeatureRoute.hub`. */
export interface HubEntry {
  readonly habit: HabitId;
  readonly titleKey: string;
  readonly icon: string;
}

/** A hub entry together with the feature path it links to. */
export interface HubLink extends HubEntry {
  readonly path: string;
}

/** One line in `app/route-registry.ts`, contributed by a feature. */
export interface FeatureRoute {
  /** URL path relative to the app root, without leading or trailing slash. */
  readonly path: string;
  readonly loadChildren: LoadChildren;
  readonly hub?: HubEntry;
}

/** The registered features, provided in `app.config.ts`. */
export const FEATURE_ROUTES = new InjectionToken<readonly FeatureRoute[]>('FEATURE_ROUTES');
