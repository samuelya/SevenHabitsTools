import { softDelete, touch, isLive } from '../../core/data/record';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import {
  allMet,
  ChecklistLabels,
  ChecklistMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { isCounted, withoutSample } from '../../shared/exercise-kit/sample-record.logic';
import type { ExerciseListItem } from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import { isValidIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { addDays } from '../../shared/commitments/commitments.logic';
import {
  CONCERN_CONTROLS,
  CONCERN_STATUSES,
  Concern,
  ConcernControl,
  ConcernFields,
  ConcernStatus,
  isConcernControl,
} from './circle.model';

const hasText = (text: string | undefined): boolean => Boolean(text?.trim());

/** Branch A (issue #53): the concern is up to the user, alone or with others, so it gets a first
 * step. Branch B (`none`) gets a line on letting it go instead. */
export function affectable(control: ConcernControl): boolean {
  return control !== 'none';
}

/** The statuses the form offers for `control`'s branch, in order. */
export function statusesFor(control: ConcernControl): readonly ConcernStatus[] {
  return affectable(control) ? ['open', 'stepTaken', 'sorted'] : ['open', 'letGo'];
}

/** The fields to store when the user picks `control`: the option itself, plus `status: 'open'`
 * when the current status belongs to the other branch (Step taken means nothing for a concern
 * that is out of anyone's hands). The other branch's text is kept (issue #53). */
export function controlChange(
  concern: Pick<Concern, 'status'>,
  control: ConcernControl,
): Partial<ConcernFields> {
  return statusesFor(control).includes(concern.status) ? { control } : { control, status: 'open' };
}

/** Whether the concern is dealt with: named, and either a first step taken (or sorted) for
 * branch A, or a letting-go line marked Let go for branch B. The issue's rule plus the concern
 * itself, which the form requires and the checklist's first item asks for. */
export function isItemComplete(
  concern: Pick<Concern, 'title' | 'control' | 'firstStep' | 'letGoNote' | 'status'>,
): boolean {
  return allMet(CHECKLIST_KEYS, concernMet(concern));
}

/** Live concerns only (architecture issue #1 §6: tombstoned records are never shown). */
export function liveConcerns(concerns: readonly Concern[]): Concern[] {
  return concerns.filter(isLive);
}

/** The live concerns that count toward progress, summaries and the done gate (`isCounted()`). */
export function countedConcerns(concerns: readonly Concern[]): Concern[] {
  return concerns.filter(isCounted);
}

/** Started once any counted concern exists (issues #216, #232). */
export function isStarted(concerns: readonly Concern[]): boolean {
  return concerns.some(isCounted);
}

/** The hub's in-progress text (issue #219): "3 concerns"; `null` with none. */
export function hubStatus(concerns: readonly Concern[]): ExerciseHubStatus | null {
  const count = countedConcerns(concerns).length;
  return count > 0 ? { key: 'habits.exercises.h1-circle.concernCount', count } : null;
}

/** The four gate items (issue #53), in the order the form asks for them. */
export const CHECKLIST_KEYS = ['concern', 'control', 'step', 'taken'] as const;
export type CircleChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** One concern's "met" map. `control` always holds an option (a new concern starts at Up to me),
 * so it is met once there is a concern to sort. All four met is exactly `isItemComplete()`. */
function concernMet(
  concern: Pick<Concern, 'title' | 'control' | 'firstStep' | 'letGoNote' | 'status'>,
): ChecklistMet<CircleChecklistKey> {
  const named = hasText(concern.title);
  const branchA = affectable(concern.control);
  return {
    concern: named,
    control: named,
    step: named && hasText(branchA ? concern.firstStep : concern.letGoNote),
    taken:
      named &&
      (branchA
        ? concern.status === 'stepTaken' || concern.status === 'sorted'
        : concern.status === 'letGo'),
  };
}

/** The checklist describes the counted concern closest to complete (`closestMet()`). */
function checklistMet(concerns: readonly Concern[]): ChecklistMet<CircleChecklistKey> {
  return closestMet(countedConcerns(concerns), CHECKLIST_KEYS, concernMet);
}

/** Whether `DoneToggle` is enabled: at least one counted concern is complete. */
export function isComplete(concerns: readonly Concern[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(concerns));
}

export function doneChecklist(
  concerns: readonly Concern[],
  labels: ChecklistLabels<CircleChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(concerns), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<CircleChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<CircleChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** The summary card's counts (issue #53): of the counted branch A concerns, how many have a
 * first step. */
export interface CircleSummary {
  readonly withStep: number;
  readonly total: number;
}

export function summarize(concerns: readonly Concern[]): CircleSummary {
  const branchA = countedConcerns(concerns).filter((concern) => affectable(concern.control));
  return {
    withStep: branchA.filter((concern) => hasText(concern.firstStep)).length,
    total: branchA.length,
  };
}

/** Already-translated labels for the row subtitle and the sample chip, built by the page. */
export interface ConcernLabels {
  readonly control: Record<ConcernControl, string>;
  readonly status: Record<ConcernStatus, string>;
  readonly example?: string;
}

/** Builds `ConcernLabels` from `translateSignal` output; `translateSignal` with an array key starts
 * at `['']`, so a missing index falls back to `''` (playbook §6). */
export function labelsFrom(
  controlLabels: readonly (string | undefined)[],
  statusLabels: readonly (string | undefined)[],
  exampleLabel?: string,
): ConcernLabels {
  return {
    ...(exampleLabel === undefined ? {} : { example: exampleLabel }),
    control: Object.fromEntries(
      CONCERN_CONTROLS.map((control, index) => [control, controlLabels[index] ?? '']),
    ) as Record<ConcernControl, string>,
    status: Object.fromEntries(
      CONCERN_STATUSES.map((status, index) => [status, statusLabels[index] ?? '']),
    ) as Record<ConcernStatus, string>,
  };
}

/** The first non-blank line of `text`, trimmed; `''` when there is none. */
function firstLine(text: string | undefined): string {
  return (
    (text ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}

/** Maps a concern to its `ExerciseList` row (issue #53): the concern as the title (falling back to
 * the other free-text fields a draft may have been saved from, else `''`, shown as "Untitled"),
 * the control option and the status as the subtitle. A sample leads with an "Example" chip and
 * never shows the done check. */
export function toListItem(concern: Concern, labels: ConcernLabels): ExerciseListItem {
  const subtitle = [labels.control[concern.control], labels.status[concern.status]]
    .filter((label) => label !== '')
    .join(' · ');
  return {
    id: concern.id,
    title:
      [concern.title, concern.firstStep, concern.letGoNote, concern.have, concern.be]
        .map(firstLine)
        .find((text) => text !== '') ?? '',
    subtitle,
    ...(concern.sample ? { chips: [{ label: labels.example ?? '' }] } : {}),
    done: !concern.sample && isItemComplete(concern),
  };
}

/** The two list groups, in the issue's order: things you can affect (branch A), then things you
 * can't control (branch B). */
export interface ConcernGroups {
  readonly affect: Concern[];
  readonly cannotControl: Concern[];
}

export function groupConcerns(concerns: readonly Concern[]): ConcernGroups {
  return {
    affect: concerns.filter((concern) => affectable(concern.control)),
    cannotControl: concerns.filter((concern) => !affectable(concern.control)),
  };
}

/** Draft before record (issue #217): a new concern's draft becomes a record once any free-text
 * field holds non-blank text. Picking the control option or a status alone keeps it a draft. */
export function isDraftWorthSaving(
  draft: Pick<ConcernFields, 'title' | 'have' | 'be' | 'firstStep' | 'letGoNote'>,
): boolean {
  return [draft.title, draft.have, draft.be, draft.firstStep, draft.letGoNote].some(hasText);
}

/** `fields` as an edit may apply them on either path, the unsaved draft's raw merge
 * (`record-draft.ts`) or `editConcern`: an empty or invalid `dueDate` (a cleared date field)
 * becomes `undefined`, which clears it, so it never reaches storage. Every other field the form
 * emits is already valid. */
export function concernEdit(fields: Partial<ConcernFields>): Partial<ConcernFields> {
  return 'dueDate' in fields && !(fields.dueDate !== undefined && isValidIsoDate(fields.dueDate))
    ? { ...fields, dueDate: undefined }
    : fields;
}

/** Replaces the fields of the live concern `id` with `fields`, leaving every other one alone. An
 * empty `dueDate` clears it (a cleared date field). Any edit makes a sample the user's own. */
export function editConcern(
  concerns: readonly Concern[],
  id: string,
  fields: Partial<ConcernFields>,
): Concern[] {
  return concerns.map((concern) => {
    if (concern.id !== id || !isLive(concern)) {
      return concern;
    }
    const edited: Concern = withoutSample({ ...concern, ...fields });
    return edited.dueDate === undefined || isValidIsoDate(edited.dueDate)
      ? edited
      : (Object.fromEntries(
          Object.entries(edited).filter(([key]) => key !== 'dueDate'),
        ) as unknown as Concern);
  });
}

/** Whether the "Make it a promise" button shows (issue #53): a branch A concern with a first step
 * and no live promise yet. A promise deleted on the Promises page frees the concern to make another. */
export function canMakePromise(
  concern: Pick<Concern, 'control' | 'firstStep'>,
  promiseExists: boolean,
): boolean {
  return affectable(concern.control) && hasText(concern.firstStep) && !promiseExists;
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** A guide example's `sample` payload as the fields of a new concern, or `null` when it isn't a
 * valid one (the i18n JSON is an input boundary). Status starts Open; a first step gets a due
 * date a week from `today` (issue #53). The caller adds `sample: true`. */
export function concernFromExample(value: unknown, today: string): ConcernFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const title = optionalText(example['title']);
  const control = example['control'];
  if (title === undefined || !isConcernControl(control)) {
    return null;
  }
  const optional = (['have', 'be', 'firstStep', 'letGoNote'] as const).flatMap((key) => {
    const text = optionalText(example[key]);
    return text === undefined ? [] : [[key, text] as const];
  });
  const fields: ConcernFields = {
    title,
    control,
    status: 'open',
    ...Object.fromEntries(optional),
  };
  return fields.firstStep ? { ...fields, dueDate: addDays(today, 7) } : fields;
}

const SAMPLE_KEYS = ['title', 'control', 'have', 'be', 'firstStep', 'letGoNote'] as const;

/** The live, still-flagged sample made from these example `fields`, if the user already tried it:
 * trying again opens that one rather than adding a copy (issue #232). The due date isn't compared:
 * it depends on the day the example was tried. */
export function liveSampleOf(
  concerns: readonly Concern[],
  fields: ConcernFields,
): Concern | undefined {
  return concerns.find(
    (concern) =>
      isLive(concern) && concern.sample && SAMPLE_KEYS.every((key) => concern[key] === fields[key]),
  );
}

/** Tombstones the concern `id` (never removed, architecture issue #1 §6). */
export function removeConcern(concerns: readonly Concern[], id: string, now: Date): Concern[] {
  return concerns.map((concern) => (concern.id === id ? softDelete(concern, now) : concern));
}

/** Undoes `removeConcern()` (the delete-with-undo snackbar). */
export function restoreConcern(concerns: readonly Concern[], id: string, now: Date): Concern[] {
  return concerns.map((concern) =>
    concern.id === id && !isLive(concern)
      ? touch({ ...concern, deletedAt: undefined }, now)
      : concern,
  );
}
