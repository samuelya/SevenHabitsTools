// The shared model first: this exercise's registry entry reads its slice.
import { MISSION_MODEL_KEY, Mission } from '../../shared/mission/mission.model';
import {
  getRegisteredExercises,
  registerExercise,
} from '../../shared/exercise-kit/exercise-registry';
import { storeStatusOnDayFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from '../../shared/mission/mission.logic';

/** This exercise's id (playbook §1), the same as the shared model's key. */
export const H2_MISSION_ID = MISSION_MODEL_KEY;

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const H2_MISSION_ROUTE = 'habits/h2/mission';

/** Registers the exercise, a no-op if already done (Vitest runs with `isolate: false`). The model
 * itself is registered by the shared file imported above (issue #61: #71 and #97 read it too). */
export function registerMissionExercise(): void {
  if (getRegisteredExercises().some((entry) => entry.exerciseId === H2_MISSION_ID)) {
    return;
  }
  registerExercise({
    exerciseId: H2_MISSION_ID,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-mission.title',
    shortTitleKey: 'habits.exercises.h2-mission.shortTitle',
    icon: 'flag',
    route: H2_MISSION_ROUTE,
    order: 50,
    isStarted: storeStartedFactory<Mission | null>(MISSION_MODEL_KEY, isStarted),
    statusFactory: storeStatusOnDayFactory<Mission | null>(MISSION_MODEL_KEY, hubStatus),
  });
}

registerMissionExercise();
