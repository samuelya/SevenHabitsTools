import { MAX_CRITERIA, ProjectStep } from './projects.model';

/**
 * The pure array edits behind a project's steps and "How you'll know" lines (issue #65). The form
 * builds the next array with these and emits it as a field edit. Every edit that changes nothing
 * returns the same array, so the store sees a no-op.
 */

export type StepDirection = 'up' | 'down';

/** A step's text as every reader sees it: trimmed. A blank step counts as no step anywhere. */
export function isFilledStep(step: Pick<ProjectStep, 'text'>): boolean {
  return step.text.trim() !== '';
}

/** Appends a step with `text` (trimmed) at the end; the same array for blank text or a key that is
 * already there. */
export function appendStep(
  steps: readonly ProjectStep[],
  key: string,
  text: string,
): readonly ProjectStep[] {
  const trimmed = text.trim();
  if (trimmed === '' || steps.some((step) => step.key === key)) {
    return steps;
  }
  return [...steps, { key, text: trimmed, done: false }];
}

function changeStep(
  steps: readonly ProjectStep[],
  key: string,
  change: (step: ProjectStep) => ProjectStep,
): readonly ProjectStep[] {
  const index = steps.findIndex((step) => step.key === key);
  if (index < 0) {
    return steps;
  }
  const changed = change(steps[index]);
  if (
    changed.text === steps[index].text &&
    changed.done === steps[index].done &&
    changed.date === steps[index].date
  ) {
    return steps;
  }
  const next = [...steps];
  next[index] = changed;
  return next;
}

export function editStepText(
  steps: readonly ProjectStep[],
  key: string,
  text: string,
): readonly ProjectStep[] {
  return changeStep(steps, key, (step) => ({ ...step, text }));
}

export function setStepDone(
  steps: readonly ProjectStep[],
  key: string,
  done: boolean,
): readonly ProjectStep[] {
  return changeStep(steps, key, (step) => ({ ...step, done }));
}

/** Sets the step's date; `null` clears it (the field left without it, never `''`). */
export function setStepDate(
  steps: readonly ProjectStep[],
  key: string,
  date: string | null,
): readonly ProjectStep[] {
  return changeStep(steps, key, (step) =>
    date === null ? { key: step.key, text: step.text, done: step.done } : { ...step, date },
  );
}

/** Whether the step `key` can move one place in `direction`. */
export function canMoveStep(
  steps: readonly ProjectStep[],
  key: string,
  direction: StepDirection,
): boolean {
  const index = steps.findIndex((step) => step.key === key);
  return index >= 0 && (direction === 'up' ? index > 0 : index < steps.length - 1);
}

/** Swaps the step `key` with its neighbour in `direction`; the same array at either end. */
export function moveStep(
  steps: readonly ProjectStep[],
  key: string,
  direction: StepDirection,
): readonly ProjectStep[] {
  if (!canMoveStep(steps, key, direction)) {
    return steps;
  }
  const index = steps.findIndex((step) => step.key === key);
  const other = direction === 'up' ? index - 1 : index + 1;
  const next = [...steps];
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}

export function removeStep(steps: readonly ProjectStep[], key: string): readonly ProjectStep[] {
  return steps.some((step) => step.key === key) ? steps.filter((step) => step.key !== key) : steps;
}

/** Whether every step with text is ticked, with at least one: the moment to offer "Mark project
 * Done". */
export function allStepsDone(steps: readonly ProjectStep[]): boolean {
  const filled = steps.filter(isFilledStep);
  return filled.length > 0 && filled.every((step) => step.done);
}

/** Appends an empty line; the same array at `MAX_CRITERIA`. */
export function appendCriterion(criteria: readonly string[]): readonly string[] {
  return criteria.length >= MAX_CRITERIA ? criteria : [...criteria, ''];
}

export function editCriterion(
  criteria: readonly string[],
  index: number,
  text: string,
): readonly string[] {
  if (index < 0 || index >= criteria.length || criteria[index] === text) {
    return criteria;
  }
  const next = [...criteria];
  next[index] = text;
  return next;
}

export function removeCriterion(criteria: readonly string[], index: number): readonly string[] {
  return index < 0 || index >= criteria.length
    ? criteria
    : criteria.filter((_, position) => position !== index);
}
