import { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';

/** What one row of the hub's status column says (issue #219). */
export type HubRowStatus =
  | { readonly kind: 'done'; readonly completedAt: string | null }
  | { readonly kind: 'progress'; readonly status: ExerciseHubStatus }
  | { readonly kind: 'started' }
  | { readonly kind: 'notStarted' };

/** Resolves a hub row's status in a fixed order, so an exercise that registers neither `isStarted`
 * nor `statusFactory` still gets a correct row: done (check and date) wins; then the exercise's own
 * in-progress text ("2 of 3 steps"); then a generic "In progress" once started; otherwise "Not
 * started". */
export function hubRowStatus(
  done: boolean,
  completedAt: string | null,
  started: boolean,
  status: ExerciseHubStatus | null,
): HubRowStatus {
  if (done) {
    return { kind: 'done', completedAt };
  }
  if (status) {
    return { kind: 'progress', status };
  }
  return started ? { kind: 'started' } : { kind: 'notStarted' };
}
