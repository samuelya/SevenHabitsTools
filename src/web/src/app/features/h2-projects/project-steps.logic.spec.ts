import {
  MAX_CRITERIA,
  allStepsDone,
  appendCriterion,
  appendStep,
  canMoveStep,
  editCriterion,
  editStepText,
  isFilledStep,
  moveStep,
  removeCriterion,
  removeStep,
  setStepDate,
  setStepDone,
} from './project-steps.logic';
import { ProjectStep } from './projects.model';

const STEPS: readonly ProjectStep[] = [
  { key: 'a', text: 'Ask', done: true },
  { key: 'b', text: 'Book', done: false, date: '2026-09-12' },
  { key: 'c', text: 'Scan', done: false },
];

const keys = (steps: readonly ProjectStep[]) => steps.map((step) => step.key);

describe('project steps', () => {
  it('appends a trimmed step at the end, never a blank one or a duplicate key', () => {
    expect(appendStep(STEPS, 'd', '  Rehearse  ').at(-1)).toEqual({
      key: 'd',
      text: 'Rehearse',
      done: false,
    });
    expect(appendStep(STEPS, 'd', '   ')).toBe(STEPS);
    expect(appendStep(STEPS, 'a', 'Again')).toBe(STEPS);
  });

  it('edits text and done by key, the same array when nothing changes', () => {
    expect(editStepText(STEPS, 'b', 'Book Rosa')[1].text).toBe('Book Rosa');
    expect(editStepText(STEPS, 'b', 'Book')).toBe(STEPS);
    expect(editStepText(STEPS, 'x', 'Nope')).toBe(STEPS);
    expect(setStepDone(STEPS, 'c', true)[2].done).toBe(true);
    expect(setStepDone(STEPS, 'a', true)).toBe(STEPS);
  });

  it('sets a date and clears it to absent, never an empty string', () => {
    expect(setStepDate(STEPS, 'a', '2026-09-20')[0].date).toBe('2026-09-20');
    const cleared = setStepDate(STEPS, 'b', null)[1];
    expect('date' in cleared).toBe(false);
    expect(setStepDate(STEPS, 'c', null)).toBe(STEPS);
  });

  it('moves up and down, the same array at either end', () => {
    expect(keys(moveStep(STEPS, 'b', 'up'))).toEqual(['b', 'a', 'c']);
    expect(keys(moveStep(STEPS, 'b', 'down'))).toEqual(['a', 'c', 'b']);
    expect(moveStep(STEPS, 'a', 'up')).toBe(STEPS);
    expect(moveStep(STEPS, 'c', 'down')).toBe(STEPS);
    expect(moveStep(STEPS, 'x', 'down')).toBe(STEPS);
    expect(canMoveStep(STEPS, 'a', 'up')).toBe(false);
    expect(canMoveStep(STEPS, 'a', 'down')).toBe(true);
    expect(canMoveStep(STEPS, 'c', 'down')).toBe(false);
  });

  it('removes by key', () => {
    expect(keys(removeStep(STEPS, 'b'))).toEqual(['a', 'c']);
    expect(removeStep(STEPS, 'x')).toBe(STEPS);
  });

  it('offers "done" only when every step with text is ticked', () => {
    expect(allStepsDone(STEPS)).toBe(false);
    expect(allStepsDone([])).toBe(false);
    const ticked = STEPS.map((step) => ({ ...step, done: true }));
    expect(allStepsDone(ticked)).toBe(true);
    expect(allStepsDone([...ticked, { key: 'z', text: '  ', done: false }])).toBe(true);
    expect(isFilledStep({ text: ' ' })).toBe(false);
  });

  it('adds criteria lines up to five, edits and removes them by index', () => {
    let criteria: readonly string[] = [];
    for (let i = 0; i < MAX_CRITERIA; i += 1) {
      criteria = appendCriterion(criteria);
    }
    expect(criteria).toHaveLength(5);
    expect(appendCriterion(criteria)).toBe(criteria);
    const edited = editCriterion(criteria, 1, 'Everyone came');
    expect(edited[1]).toBe('Everyone came');
    expect(editCriterion(edited, 1, 'Everyone came')).toBe(edited);
    expect(editCriterion(edited, 9, 'x')).toBe(edited);
    expect(removeCriterion(edited, 1)).toEqual(['', '', '', '']);
    expect(removeCriterion(edited, -1)).toBe(edited);
  });
});
