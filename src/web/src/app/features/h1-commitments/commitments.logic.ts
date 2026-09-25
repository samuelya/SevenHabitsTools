import { isLive } from '../../core/data/record';
import {
  addDays,
  integrityRate,
  IntegrityRate,
  isOverdue,
} from '../../shared/commitments/commitments.logic';
import {
  COMMITMENT_STATUSES,
  Commitment,
  CommitmentFields,
  CommitmentStatus,
  isCommitmentRecipient,
} from '../../shared/commitments/commitments.model';
import {
  ChecklistLabels,
  ChecklistMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import {
  ExerciseListChip,
  ExerciseListItem,
} from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import { isCounted } from '../../shared/exercise-kit/sample-record.logic';
import { isValidIsoDate } from '../../shared/exercise-kit/assessment-history.logic';

/** The page's own rules for the Promises exercise (issue #57). The shared, cross-tool rules
 * (overdue, rates, edits) are in `shared/commitments/commitments.logic.ts`. */

/** Started once any counted promise exists (issues #216, #232). */
export function isStarted(list: readonly Commitment[]): boolean {
  return list.some(isCounted);
}

/** The hub's status text (issue #57): "3 open" while nothing is resolved, "4 of 5 kept" after;
 * `null` with nothing to count. */
export function hubStatus(list: readonly Commitment[]): ExerciseHubStatus | null {
  const counted = list.filter(isCounted);
  const kept = counted.filter((c) => c.status === 'kept').length;
  const resolved = kept + counted.filter((c) => c.status === 'broken').length;
  if (resolved > 0) {
    return { key: 'habits.exercises.h1-commitments.keptOf', count: resolved, params: { kept } };
  }
  const open = counted.filter((c) => c.status === 'open').length;
  return open > 0 ? { key: 'habits.exercises.h1-commitments.openCount', count: open } : null;
}

/** The three gate items (issue #57), in the order the user does them. */
export const CHECKLIST_KEYS = ['promise', 'dueDate', 'kept'] as const;
export type CommitmentsChecklistKey = (typeof CHECKLIST_KEYS)[number];

function commitmentMet(c: Commitment): ChecklistMet<CommitmentsChecklistKey> {
  return {
    promise: c.text.trim() !== '',
    dueDate: Boolean(c.dueDate),
    kept: c.status === 'kept',
  };
}

/** A Kept promise with text: what opens the gate. A promise typed, cleared and marked Kept
 * doesn't. */
function opensGate(c: Commitment): boolean {
  const met = commitmentMet(c);
  return met.promise && met.kept;
}

/** The checklist describes a promise that opens the gate when there is one (so both its `promise`
 * and `kept` rows are met), otherwise the counted promise closest to it (so they never both are). */
function checklistMet(list: readonly Commitment[]): ChecklistMet<CommitmentsChecklistKey> {
  const counted = list.filter(isCounted);
  const passing = counted.filter(opensGate);
  return closestMet(passing.length ? passing : counted, CHECKLIST_KEYS, commitmentMet);
}

/** "Mark done" is enabled once a counted promise with text is Kept (issue #57): exactly when the
 * checklist's `promise` and `kept` rows are both met, so the two never disagree. The due date row
 * is advice, not a gate. */
export function isComplete(list: readonly Commitment[]): boolean {
  const met = checklistMet(list);
  return met.promise && met.kept;
}

export function doneChecklist(
  list: readonly Commitment[],
  labels: ChecklistLabels<CommitmentsChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(list), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<CommitmentsChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<CommitmentsChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** The list's status filter (issue #57). */
export const COMMITMENT_FILTERS = ['all', 'open', 'dueToday', 'overdue', 'kept', 'broken'] as const;
export type CommitmentFilter = (typeof COMMITMENT_FILTERS)[number];

/** Whether `c` shows under `filter` on `today`, and under the "From" filter `sourceId` (`null`:
 * any source, or none). */
export function matchesFilter(
  c: Commitment,
  filter: CommitmentFilter,
  sourceId: string | null,
  today: string,
): boolean {
  if (sourceId !== null && c.source?.exerciseId !== sourceId) {
    return false;
  }
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return c.status === 'open';
    case 'dueToday':
      return c.status === 'open' && c.dueDate === today;
    case 'overdue':
      return isOverdue(c, today);
    case 'kept':
    case 'broken':
      return c.status === filter;
  }
}

/** The distinct source exercises of the live promises, in first-seen order: the "From" filter's
 * options, empty when no live promise has a source. */
export function sourceIds(list: readonly Commitment[]): string[] {
  return [...new Set(list.filter(isLive).flatMap((c) => (c.source ? [c.source.exerciseId] : [])))];
}

/** Open promises first, soonest due first (undated last), then resolved ones, latest first. */
export function listOrder(list: readonly Commitment[]): Commitment[] {
  const open = list.filter((c) => c.status === 'open');
  const resolved = list.filter((c) => c.status !== 'open');
  open.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  resolved.sort((a, b) => (b.resolvedOn ?? '').localeCompare(a.resolvedOn ?? ''));
  return [...open, ...resolved];
}

/** "How you're doing" (issue #57): `null` until a counted promise is Kept or Broken, so the card
 * never shows a zero. `last30` is `null` while nothing was resolved in the last 30 days. */
export interface CommitmentsSummary {
  readonly allTime: IntegrityRate;
  readonly last30: IntegrityRate | null;
}

/** The summary's recent window, in days. */
export const SUMMARY_WINDOW_DAYS = 30;

export function summarize(list: readonly Commitment[], today: string): CommitmentsSummary | null {
  const allTime = integrityRate(list, { today });
  if (allTime.rate === null) {
    return null;
  }
  const last30 = integrityRate(list, { today, windowDays: SUMMARY_WINDOW_DAYS });
  return { allTime, last30: last30.rate === null ? null : last30 };
}

/** The token `sourceLine()` replaces: the page translates `list.sourceText` with this as its
 * `exercise` param, so one translation serves every source. No `{{…}}`: Transloco re-scans the
 * interpolated value, so a braced token loops forever. */
export const SOURCE_TOKEN = '@@exercise@@';

/** "From: Your influence": `template` (`list.sourceText`, token kept) with the source's title. */
export function sourceLine(template: string, title: string): string {
  return template.replace(SOURCE_TOKEN, title);
}

/** Already-translated text for a row, built by the page (playbook §6 "Reactive labels"). */
export interface CommitmentLabels {
  readonly status: Record<CommitmentStatus, string>;
  readonly example: string;
  readonly overdue: string;
  /** `list.sourceText` with `SOURCE_TOKEN` still in it. */
  readonly sourceTemplate: string;
  /** Short titles by `exerciseId` (`habits.exercises.<id>.shortTitle`). */
  readonly sourceTitles: Readonly<Record<string, string>>;
  /** Formats a `YYYY-MM-DD` for display in the active locale. */
  readonly formatDate: (date: string) => string;
}

/** `translateSignal`'s array output as a record keyed like `keys`, `''` before the scope loads
 * (playbook §6's second pitfall). */
export function labelsByKey<K extends string>(
  keys: readonly K[],
  translated: readonly (string | undefined)[],
): Record<K, string> {
  return Object.fromEntries(keys.map((key, index) => [key, translated[index] ?? ''])) as Record<
    K,
    string
  >;
}

export function statusLabelsFrom(
  translated: readonly (string | undefined)[],
): Record<CommitmentStatus, string> {
  return labelsByKey(COMMITMENT_STATUSES, translated);
}

/** The source's line, or `''` for none or a source whose title is unknown. */
export function sourceLabel(c: Commitment, labels: CommitmentLabels): string {
  const title = c.source ? labels.sourceTitles[c.source.exerciseId] : undefined;
  return title ? sourceLine(labels.sourceTemplate, title) : '';
}

/** A promise as an `ExerciseList` row: the promise as title, its due date and status as subtitle,
 * then "Example" and the source line as chips. An overdue row is a warning with a hidden
 * "Overdue" prefix; a sample is never overdue or done. */
export function toListItem(
  c: Commitment,
  labels: CommitmentLabels,
  today: string,
): ExerciseListItem {
  const chips: ExerciseListChip[] = [];
  if (c.sample) {
    chips.push({ label: labels.example });
  }
  const source = sourceLabel(c, labels);
  if (source) {
    chips.push({ label: source });
  }
  const warning = !c.sample && isOverdue(c, today);
  return {
    id: c.id,
    title: c.text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '',
    subtitle: [
      c.dueDate && isValidIsoDate(c.dueDate) ? labels.formatDate(c.dueDate) : '',
      labels.status[c.status],
    ]
      .filter((part) => part !== '')
      .join(' · '),
    ...(chips.length ? { chips } : {}),
    done: !c.sample && c.status === 'kept',
    ...(warning ? { warning, warningLabel: labels.overdue } : {}),
  };
}

/** Draft before record (issue #217): a new promise becomes a record on its first typed text. */
export function isDraftWorthSaving(draft: Pick<CommitmentFields, 'text'>): boolean {
  return draft.text.trim() !== '';
}

/** Days from creation to a sample's due date (issue #57: today + 3, never a stored date). */
export const SAMPLE_DUE_IN_DAYS = 3;

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** A guide example's `sample` payload as an open promise due `SAMPLE_DUE_IN_DAYS` after `today`,
 * or `null` when it isn't valid (the i18n JSON is an input boundary). */
export function commitmentFromExample(value: unknown, today: string): CommitmentFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const text = optionalText(example['text']);
  const toWhom = example['toWhom'];
  if (text === undefined || !isCommitmentRecipient(toWhom)) {
    return null;
  }
  const personName = toWhom === 'other' ? optionalText(example['personName']) : undefined;
  return {
    text,
    toWhom,
    ...(personName === undefined ? {} : { personName }),
    dueDate: addDays(today, SAMPLE_DUE_IN_DAYS),
    status: 'open',
  };
}

/** The live, untouched sample with this example's text, if the user already tried it: trying it
 * again opens that one instead of adding a copy (issue #232). */
export function liveSampleOf(
  list: readonly Commitment[],
  fields: Pick<CommitmentFields, 'text'>,
): Commitment | undefined {
  return list.find((c) => isLive(c) && c.sample && c.text === fields.text);
}
