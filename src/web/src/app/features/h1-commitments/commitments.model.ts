// The shared model first: this exercise's registry entry reads its slice.
import { COMMITMENTS_MODEL_KEY, Commitment } from '../../shared/commitments/commitments.model';
import {
  registerExercise,
  getRegisteredExercises,
} from '../../shared/exercise-kit/exercise-registry';
import { storeStatusFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from './commitments.logic';

/** This exercise's id (playbook §1). Its data is not keyed by it: promises live in the shared
 * `commitments` model (`shared/commitments/commitments.model.ts`, issue #57), which other Habit 1
 * tools write to as well. */
export const H1_COMMITMENTS_ID = 'h1-commitments';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const H1_COMMITMENTS_ROUTE = 'habits/h1/commitments';

/** Registers the exercise, a no-op if already done (Vitest runs with `isolate: false`). The model
 * itself is registered by the shared file imported above. */
export function registerCommitmentsExercise(): void {
  if (getRegisteredExercises().some((entry) => entry.exerciseId === H1_COMMITMENTS_ID)) {
    return;
  }
  registerExercise({
    exerciseId: H1_COMMITMENTS_ID,
    habit: 'h1',
    titleKey: 'habits.exercises.h1-commitments.title',
    shortTitleKey: 'habits.exercises.h1-commitments.shortTitle',
    icon: 'handshake',
    route: H1_COMMITMENTS_ROUTE,
    order: 50,
    isStarted: storeStartedFactory<Commitment[]>(COMMITMENTS_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<Commitment[]>(COMMITMENTS_MODEL_KEY, hubStatus),
  });
}

registerCommitmentsExercise();
