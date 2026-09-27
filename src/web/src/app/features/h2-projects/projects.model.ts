// The shared model first: this exercise's registry entry reads its slice.
import { PROJECTS_MODEL_KEY, Project } from '../../shared/projects/projects.model';
import {
  getRegisteredExercises,
  registerExercise,
} from '../../shared/exercise-kit/exercise-registry';
import { storeStatusFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from '../../shared/projects/projects.logic';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). Its id and data are
 * the shared `h2-projects` model's (`shared/projects/projects.model.ts`), which the weekly planner
 * (#71) reads as well. */
export const PROJECTS_ROUTE = 'habits/h2/projects';

/** Registers the exercise, a no-op if already done (Vitest runs with `isolate: false`). The model
 * itself is registered by the shared file imported above. */
export function registerProjectsExercise(): void {
  if (getRegisteredExercises().some((entry) => entry.exerciseId === PROJECTS_MODEL_KEY)) {
    return;
  }
  registerExercise({
    exerciseId: PROJECTS_MODEL_KEY,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-projects.title',
    shortTitleKey: 'habits.exercises.h2-projects.shortTitle',
    icon: 'flag',
    route: PROJECTS_ROUTE,
    order: 70,
    isStarted: storeStartedFactory<Project[]>(PROJECTS_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<Project[]>(PROJECTS_MODEL_KEY, hubStatus),
  });
}

registerProjectsExercise();
