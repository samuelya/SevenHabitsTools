import { softDelete, touch, isLive } from '../../core/data/record';
import type { CommitmentEdit } from '../../shared/commitments/commitments.logic';
import type { Commitment } from '../../shared/commitments/commitments.model';
import type { NewCommitment } from '../../shared/commitments/commitments.service';
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
import {
  FollowUpKept,
  FollowUpResult,
  REHEARSAL_MODEL_KEY,
  Rehearsal,
  RehearsalFields,
  RehearsalFollowUp,
} from './rehearsal.model';

const hasText = (text: string | undefined): boolean => Boolean(text?.trim());

/** `date` when it is a real `YYYY-MM-DD` date, else `undefined`. */
const validDate = (date: string | undefined): string | undefined =>
  date !== undefined && isValidIsoDate(date) ? date : undefined;

/** The scene counts as written from this many characters, trimmed (issue #55). */
export const SCENE_MIN_LENGTH = 60;

/** Whether the chosen response is long enough to count as a short scene. */
export function sceneWritten(text: string | undefined): boolean {
  return (text?.trim().length ?? 0) >= SCENE_MIN_LENGTH;
}

/** The four gate items (issue #55), in the order the form asks for them. */
export const CHECKLIST_KEYS = ['trigger', 'usual', 'scene', 'promise'] as const;
export type RehearsalChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** One rehearsal's "met" map. All four met is exactly `isItemComplete()`: the moment, the usual
 * reaction and its cost, the scene, and the promise with its date. */
function rehearsalMet(
  rehearsal: Pick<
    Rehearsal,
    'trigger' | 'expectedOn' | 'usualReaction' | 'cost' | 'chosenResponse' | 'promise'
  >,
): ChecklistMet<RehearsalChecklistKey> {
  return {
    trigger: hasText(rehearsal.trigger),
    usual: hasText(rehearsal.usualReaction) && hasText(rehearsal.cost),
    scene: sceneWritten(rehearsal.chosenResponse),
    promise: hasText(rehearsal.promise) && validDate(rehearsal.expectedOn) !== undefined,
  };
}

/** Issue #55's rule: `trigger`, `expectedOn`, `usualReaction`, `cost` and `promise` set, and a
 * scene of at least `SCENE_MIN_LENGTH` characters. The follow-up is not required. */
export function isItemComplete(
  rehearsal: Pick<
    Rehearsal,
    'trigger' | 'expectedOn' | 'usualReaction' | 'cost' | 'chosenResponse' | 'promise'
  >,
): boolean {
  return allMet(CHECKLIST_KEYS, rehearsalMet(rehearsal));
}

/** Live rehearsals only (architecture issue #1 §6: tombstoned records are never shown). */
export function liveRehearsals(rehearsals: readonly Rehearsal[]): Rehearsal[] {
  return rehearsals.filter(isLive);
}

/** The live rehearsals that count toward progress, summaries and the done gate (`isCounted()`). */
export function countedRehearsals(rehearsals: readonly Rehearsal[]): Rehearsal[] {
  return rehearsals.filter(isCounted);
}

/** Started once any counted rehearsal exists (issues #216, #232). */
export function isStarted(rehearsals: readonly Rehearsal[]): boolean {
  return rehearsals.some(isCounted);
}

/** The hub's in-progress text (issue #219): "2 rehearsals"; `null` with none. */
export function hubStatus(rehearsals: readonly Rehearsal[]): ExerciseHubStatus | null {
  const count = countedRehearsals(rehearsals).length;
  return count > 0 ? { key: 'habits.exercises.h1-rehearsal.rehearsalCount', count } : null;
}

/** The checklist describes the counted rehearsal closest to complete (`closestMet()`). */
function checklistMet(rehearsals: readonly Rehearsal[]): ChecklistMet<RehearsalChecklistKey> {
  return closestMet(countedRehearsals(rehearsals), CHECKLIST_KEYS, rehearsalMet);
}

/** Whether `DoneToggle` is enabled: at least one counted rehearsal is complete. */
export function isComplete(rehearsals: readonly Rehearsal[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(rehearsals));
}

export function doneChecklist(
  rehearsals: readonly Rehearsal[],
  labels: ChecklistLabels<RehearsalChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(rehearsals), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<RehearsalChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<RehearsalChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** A row's status (issue #55): followed up once the moment happened and was written up, due once
 * its date is today or earlier, else planned (a rehearsal without a date is planned). */
export const ROW_STATUSES = ['planned', 'due', 'followedUp'] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

export function rowStatus(
  rehearsal: Pick<Rehearsal, 'expectedOn' | 'followUp'>,
  today: string,
): RowStatus {
  if (rehearsal.followUp?.happened) {
    return 'followedUp';
  }
  const date = validDate(rehearsal.expectedOn);
  return date !== undefined && date <= today ? 'due' : 'planned';
}

/** Whether the "Afterwards" section shows: the date is today or earlier. */
export function followUpOpen(rehearsal: Pick<Rehearsal, 'expectedOn'>, today: string): boolean {
  const date = validDate(rehearsal.expectedOn);
  return date !== undefined && date <= today;
}

/** The summary card's counts (issue #55): of the counted rehearsals that were followed up, how
 * many went as planned. */
export interface SuccessRatio {
  readonly chosen: number;
  readonly count: number;
}

export function successRatio(rehearsals: readonly Rehearsal[]): SuccessRatio {
  const followedUp = countedRehearsals(rehearsals).filter((r) => r.followUp?.happened);
  return {
    chosen: followedUp.filter((r) => r.followUp?.result === 'chosen').length,
    count: followedUp.length,
  };
}

/** Soonest first (issue #55); a rehearsal without a date goes last, and ties keep the order the
 * rehearsals were added in. */
export function byDate(rehearsals: readonly Rehearsal[]): Rehearsal[] {
  const key = (r: Rehearsal): string => validDate(r.expectedOn) ?? '9999-99-99';
  return [...rehearsals].sort(
    (a, b) => key(a).localeCompare(key(b)) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Already-translated labels for the row subtitle and the sample chip, built by the page. */
export interface RehearsalLabels {
  readonly status: Record<RowStatus, string>;
  readonly example?: string;
  /** The locale's medium date for a valid `YYYY-MM-DD`. */
  readonly formatDate: (date: string) => string;
}

/** Builds the status labels from `translateSignal` output; `translateSignal` with an array key
 * starts at `['']`, so a missing index falls back to `''` (playbook §6). */
export function statusLabelsFrom(
  labels: readonly (string | undefined)[],
): Record<RowStatus, string> {
  return Object.fromEntries(
    ROW_STATUSES.map((status, index) => [status, labels[index] ?? '']),
  ) as Record<RowStatus, string>;
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

/** Maps a rehearsal to its `ExerciseList` row (issue #55): the moment as the title (falling back
 * to the other free-text fields a draft may have been saved from, else `''`, shown as
 * "Untitled"), the date and the row status as the subtitle. A sample leads with an "Example" chip
 * and never shows the done check. */
export function toListItem(
  rehearsal: Rehearsal,
  labels: RehearsalLabels,
  today: string,
): ExerciseListItem {
  const date = validDate(rehearsal.expectedOn);
  const subtitle = [
    date === undefined ? '' : labels.formatDate(date),
    labels.status[rowStatus(rehearsal, today)],
  ]
    .filter((label) => label !== '')
    .join(' · ');
  return {
    id: rehearsal.id,
    title:
      [
        rehearsal.trigger,
        rehearsal.promise,
        rehearsal.usualReaction,
        rehearsal.cost,
        rehearsal.chosenResponse,
      ]
        .map(firstLine)
        .find((text) => text !== '') ?? '',
    subtitle,
    ...(rehearsal.sample ? { chips: [{ label: labels.example ?? '' }] } : {}),
    done: !rehearsal.sample && isItemComplete(rehearsal),
  };
}

/** Draft before record (issue #217): a new rehearsal's draft becomes a record once any free-text
 * field holds non-blank text. Picking a date alone keeps it a draft. */
export function isDraftWorthSaving(
  draft: Pick<RehearsalFields, 'trigger' | 'usualReaction' | 'cost' | 'chosenResponse' | 'promise'>,
): boolean {
  return [draft.trigger, draft.usualReaction, draft.cost, draft.chosenResponse, draft.promise].some(
    hasText,
  );
}

/** `fields` as an edit may apply them on either path, the unsaved draft's raw merge
 * (`record-draft.ts`) or `editRehearsal`: an empty or invalid `expectedOn` (a cleared date field)
 * becomes `undefined`, which clears it, so it never reaches storage. Every other field the form
 * emits is already valid. */
export function rehearsalEdit(fields: Partial<RehearsalFields>): Partial<RehearsalFields> {
  return 'expectedOn' in fields && validDate(fields.expectedOn) === undefined
    ? { ...fields, expectedOn: undefined }
    : fields;
}

/** Replaces the fields of the live rehearsal `id` with `fields`, leaving every other one alone.
 * An `undefined` field is dropped rather than stored. Any edit makes a sample the user's own. */
export function editRehearsal(
  rehearsals: readonly Rehearsal[],
  id: string,
  fields: Partial<RehearsalFields>,
): Rehearsal[] {
  return rehearsals.map((rehearsal) => {
    if (rehearsal.id !== id || !isLive(rehearsal)) {
      return rehearsal;
    }
    const edited = withoutSample({ ...rehearsal, ...rehearsalEdit(fields) });
    return Object.fromEntries(
      Object.entries(edited).filter(([, value]) => value !== undefined),
    ) as unknown as Rehearsal;
  });
}

/** What the page must ask `CommitmentsService` for after an edit (issue #55's #57 contract). */
export type PromiseSync =
  | { readonly kind: 'add'; readonly commitment: NewCommitment }
  | { readonly kind: 'update'; readonly id: string; readonly edit: CommitmentEdit };

/**
 * The one call, if any, that keeps the rehearsal's promise in step with it. `commitment` is the
 * live promise `commitmentId` names, `null` without one or once it was deleted (which frees the
 * rehearsal to make another, as #53 does).
 *
 * - No live promise: `add` once the promise line and a valid date are both set.
 * - An open promise: `update` with only the text and due date that differ. An emptied promise line
 *   never pushes empty text; a cleared date clears the due date.
 * - A resolved promise: nothing (#57 only edits an open one).
 *
 * A sample is never synced: it counts toward nothing until the user edits it.
 */
export function promiseSync(
  rehearsal: Rehearsal,
  commitment: Commitment | null,
): PromiseSync | null {
  if (rehearsal.sample) {
    return null;
  }
  const text = rehearsal.promise?.trim() ?? '';
  const dueDate = validDate(rehearsal.expectedOn);
  if (commitment === null) {
    return text !== '' && dueDate !== undefined
      ? {
          kind: 'add',
          commitment: {
            text,
            dueDate,
            toWhom: 'self',
            source: { exerciseId: REHEARSAL_MODEL_KEY, recordId: rehearsal.id },
          },
        }
      : null;
  }
  if (commitment.status !== 'open') {
    return null;
  }
  const edit: { text?: string; dueDate?: string } = {};
  if (text !== '' && text !== commitment.text) {
    edit.text = text;
  }
  if ((dueDate ?? '') !== (commitment.dueDate ?? '')) {
    edit.dueDate = dueDate ?? '';
  }
  return Object.keys(edit).length > 0 ? { kind: 'update', id: commitment.id, edit } : null;
}

/** The "Your promise" answer a result pre-selects (issue #55): Kept for As I planned, Broken for
 * The old way, nothing for Partly. */
export function defaultKept(result: FollowUpResult): FollowUpKept | undefined {
  if (result === 'chosen') {
    return 'kept';
  }
  return result === 'reacted' ? 'broken' : undefined;
}

/** Whether a follow-up can be saved: "Not yet" always; "Yes" once the promise is marked Kept or
 * Broken (required, issue #55). */
export function followUpValid(followUp: RehearsalFollowUp): boolean {
  return !followUp.happened || followUp.kept !== undefined;
}

/** `followUp` as it is stored: "Not yet" keeps only `happened`, and an absent or blank answer is
 * dropped. */
export function tidyFollowUp(followUp: RehearsalFollowUp): RehearsalFollowUp {
  if (!followUp.happened) {
    return { happened: false };
  }
  return {
    happened: true,
    ...(followUp.result ? { result: followUp.result } : {}),
    ...(followUp.kept ? { kept: followUp.kept } : {}),
    ...(hasText(followUp.learned) ? { learned: followUp.learned } : {}),
  };
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const SAMPLE_KEYS = ['trigger', 'usualReaction', 'cost', 'chosenResponse', 'promise'] as const;

/** A guide example's `sample` payload as the fields of a new rehearsal, or `null` when it isn't a
 * valid one (the i18n JSON is an input boundary). No date: the user picks one, which then makes
 * the promise (issue #55). The caller adds `sample: true`. */
export function rehearsalFromExample(value: unknown): RehearsalFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const trigger = optionalText(example['trigger']);
  if (trigger === undefined) {
    return null;
  }
  const optional = SAMPLE_KEYS.slice(1).flatMap((key) => {
    const text = optionalText(example[key]);
    return text === undefined ? [] : [[key, text] as const];
  });
  return { trigger, ...Object.fromEntries(optional) };
}

/** The live, still-flagged sample made from these example `fields`, if the user already tried it:
 * trying again opens that one rather than adding a copy (issue #232). */
export function liveSampleOf(
  rehearsals: readonly Rehearsal[],
  fields: RehearsalFields,
): Rehearsal | undefined {
  return rehearsals.find(
    (rehearsal) =>
      isLive(rehearsal) &&
      rehearsal.sample &&
      SAMPLE_KEYS.every((key) => rehearsal[key] === fields[key]),
  );
}

/** Tombstones the rehearsal `id` (never removed, architecture issue #1 §6). */
export function removeRehearsal(
  rehearsals: readonly Rehearsal[],
  id: string,
  now: Date,
): Rehearsal[] {
  return rehearsals.map((rehearsal) =>
    rehearsal.id === id ? softDelete(rehearsal, now) : rehearsal,
  );
}

/** Undoes `removeRehearsal()` (the delete-with-undo snackbar). */
export function restoreRehearsal(
  rehearsals: readonly Rehearsal[],
  id: string,
  now: Date,
): Rehearsal[] {
  return rehearsals.map((rehearsal) =>
    rehearsal.id === id && !isLive(rehearsal)
      ? touch({ ...rehearsal, deletedAt: undefined }, now)
      : rehearsal,
  );
}
