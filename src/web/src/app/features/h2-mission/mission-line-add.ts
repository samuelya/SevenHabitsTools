import { AddOutcome } from '../../shared/mission/mission.logic';

/** A line the user typed, asking the page to add it. The page reports what happened through
 * `settle()`, and the input keeps the text unless the line is now in the list. */
export interface LineAdd {
  readonly text: string;
  settle(outcome: AddOutcome): void;
}

/** Whether the typed text can be cleared: the line is in the list now. */
export function clearsInput(outcome: AddOutcome): boolean {
  return outcome === 'added' || outcome === 'duplicate';
}
