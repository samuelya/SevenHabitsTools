// The shared model first: this exercise's registry entry reads its slice.
import { ROLES_MODEL_KEY, Role } from '../../shared/roles/roles.model';
import {
  registerExercise,
  getRegisteredExercises,
} from '../../shared/exercise-kit/exercise-registry';
import { storeStatusFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from './roles.logic';

/** This exercise's id (playbook §1). Its data is not keyed by it: roles live in the shared `roles`
 * model (`shared/roles/roles.model.ts`, issue #59), which Habits 3 and 7 read as well. */
export const H2_ROLES_ID = 'h2-roles';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const H2_ROLES_ROUTE = 'habits/h2/roles';

/** Registers the exercise, a no-op if already done (Vitest runs with `isolate: false`). The model
 * itself is registered by the shared file imported above. */
export function registerRolesExercise(): void {
  if (getRegisteredExercises().some((entry) => entry.exerciseId === H2_ROLES_ID)) {
    return;
  }
  registerExercise({
    exerciseId: H2_ROLES_ID,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-roles.title',
    shortTitleKey: 'habits.exercises.h2-roles.shortTitle',
    icon: 'diversity_3',
    route: H2_ROLES_ROUTE,
    order: 20,
    isStarted: storeStartedFactory<Role[]>(ROLES_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<Role[]>(ROLES_MODEL_KEY, hubStatus),
  });
}

registerRolesExercise();
