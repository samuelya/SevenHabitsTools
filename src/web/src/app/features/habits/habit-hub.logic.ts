import { HubStatusText } from '../../shared/exercise-kit/exercise-registry';

/** What one row of the hub's status column says (issue #219). */
export type HubRowStatus =
  | { readonly kind: 'done'; readonly completedAt: string | null }
  | { readonly kind: 'progress'; readonly status: HubStatusText }
  | { readonly kind: 'started' }
  | { readonly kind: 'notStarted' };

/** Resolves a hub row's status in a fixed order, so an exercise that registers neither `isStarted`
 * nor `statusFactory` still gets a correct row: a status flagged `overridesDone` ("Review due",
 * #62) wins; then done (check and date); then the exercise's own
 * in-progress text ("2 of 3 steps"); then a generic "In progress" once started; otherwise "Not
 * started". */
export function hubRowStatus(
  done: boolean,
  completedAt: string | null,
  started: boolean,
  status: HubStatusText | null,
): HubRowStatus {
  if (status?.overridesDone) {
    return { kind: 'progress', status };
  }
  if (done) {
    return { kind: 'done', completedAt };
  }
  if (status) {
    return { kind: 'progress', status };
  }
  return started ? { kind: 'started' } : { kind: 'notStarted' };
}
