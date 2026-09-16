import { InjectionToken } from '@angular/core';
import { HabitId } from '../../core/habits/habits';

/** An exercise not yet registered (`shared/exercise-kit/exercise-registry.ts`), previewed on its
 * habit hub as "coming soon" (issue #31). */
export interface ComingSoonExercise {
  readonly habit: HabitId;
  readonly titleKey: string;
}

/**
 * This app's only feature flag today: an unregistered exercise is previewed as "coming soon" on
 * its habit hub only when listed here — same `InjectionToken` shape as `FEATURE_ROUTES`
 * (`core/routing/feature-route.ts`), so tests can override it the same way. Provided as `[]` in
 * `app.config.ts`: which Phase 2 exercises to preview is a content decision for the backlog, not
 * one this frontend change should invent, so the list starts empty and today's hub shows the
 * plain "no exercises yet" empty state instead.
 */
export const HABIT_HUB_COMING_SOON = new InjectionToken<readonly ComingSoonExercise[]>(
  'HABIT_HUB_COMING_SOON',
);
