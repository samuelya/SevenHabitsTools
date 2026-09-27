import { isLive, softDelete, touch } from '../../core/data/record';
import { isValidIsoDate } from '../exercise-kit/assessment-history.logic';
import {
  ChecklistLabels,
  ChecklistMet,
  allMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../exercise-kit/done-toggle/done-toggle';
import type { ExerciseHubStatus } from '../exercise-kit/exercise-registry';
import { ExerciseListItem } from '../exercise-kit/exercise-list/exercise-list.logic';
import { isCounted, withoutSample } from '../exercise-kit/sample-record.logic';
import { addDays } from '../commitments/commitments.logic';
import { isFilledStep } from './project-steps.logic';
import {
  MAX_CRITERIA,
  Project,
  ProjectFields,
  ProjectStatus,
  ProjectStep,
  isProjectStatus,
} from './projects.model';

const hasText = (value: string | undefined): boolean => (value ?? '').trim() !== '';

// ---- One project ----

/** The guard (issue #65): steps open once "What done looks like" has text. */
export function canAddSteps(project: Pick<Project, 'desiredResult'>): boolean {
  return hasText(project.desiredResult);
}

/** Steps with text, done or not, in order: blank ones count as no step anywhere. */
export function filledSteps(project: Pick<Project, 'steps'>): ProjectStep[] {
  return project.steps.filter(isFilledStep);
}

/** "2 of 5 steps". */
export function progress(project: Pick<Project, 'steps'>): {
  readonly done: number;
  readonly total: number;
} {
  const steps = filledSteps(project);
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

/** Done and Dropped are "finished"; Planning and Under way are "under way". */
export function isFinished(status: ProjectStatus): boolean {
  return status === 'done' || status === 'dropped';
}

/** Complete: a desired result, at least one step and status Done. */
export function isItemComplete(
  project: Pick<Project, 'desiredResult' | 'steps' | 'status'>,
): boolean {
  return (
    hasText(project.desiredResult) && filledSteps(project).length > 0 && project.status === 'done'
  );
}

/** A deadline before `today` on a project that isn't finished. */
export function isOverdue(project: Pick<Project, 'deadline' | 'status'>, today: string): boolean {
  return project.deadline !== undefined && project.deadline < today && !isFinished(project.status);
}

/** Draft before record (issue #217): typed text in the name, the desired result, a criterion or a
 * step. A status or a date alone keeps it a draft. */
export function isDraftWorthSaving(
  draft: Pick<ProjectFields, 'name' | 'desiredResult' | 'criteria' | 'steps'>,
): boolean {
  return (
    hasText(draft.name) ||
    hasText(draft.desiredResult) ||
    draft.criteria.some(hasText) ||
    draft.steps.some(isFilledStep)
  );
}

// ---- Across the list ----

/** Live projects the user wrote (samples don't count; issue #232): the one rule for the hub, the
 * summary, the gate and `allOpenSteps()`. */
export function countedProjects(list: readonly Project[]): Project[] {
  return list.filter(isCounted);
}

export function isStarted(list: readonly Project[]): boolean {
  return countedProjects(list).some((project) => hasText(project.name));
}

/** A step the weekly planner (#71) may offer as a big rock. */
export interface OpenProjectStep {
  readonly projectId: string;
  readonly key: string;
  readonly text: string;
}

/** Newest first; ties by id, so the order is stable. */
function newestFirst(a: Project, b: Project): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

/** Every step with text, not ticked, of a counted project that isn't finished: newest project
 * first, steps in order. Deleted, sample, Done and Dropped projects offer nothing. */
export function allOpenSteps(list: readonly Project[]): OpenProjectStep[] {
  return countedProjects(list)
    .filter((project) => !isFinished(project.status))
    .sort(newestFirst)
    .flatMap((project) =>
      filledSteps(project)
        .filter((step) => !step.done)
        .map((step) => ({ projectId: project.id, key: step.key, text: step.text.trim() })),
    );
}

/** "2 under way" (Planning + Under way); `null` with none. */
export function hubStatus(list: readonly Project[]): ExerciseHubStatus | null {
  const count = countedProjects(list).filter((project) => !isFinished(project.status)).length;
  return count > 0 ? { key: 'habits.exercises.h2-projects.underWayCount', count } : null;
}

/** The summary card: `null` until a counted project exists, so it never shows a zero. `steps` is
 * 0 when no counted project has a step yet, and the page leaves that line out. */
export interface ProjectsSummary {
  readonly count: number;
  readonly done: number;
  readonly steps: number;
  readonly stepsDone: number;
}

export function summarize(list: readonly Project[]): ProjectsSummary | null {
  const counted = countedProjects(list);
  if (counted.length === 0) {
    return null;
  }
  const steps = counted.flatMap(filledSteps);
  return {
    count: counted.length,
    done: counted.filter((project) => project.status === 'done').length,
    steps: steps.length,
    stepsDone: steps.filter((step) => step.done).length,
  };
}

/** Live projects under way (Planning + Under way), samples included, in the order added. */
export function underWayProjects(list: readonly Project[]): Project[] {
  return list.filter((project) => isLive(project) && !isFinished(project.status));
}

/** Live finished projects (Done + Dropped), samples included, in the order added. */
export function finishedProjects(list: readonly Project[]): Project[] {
  return list.filter((project) => isLive(project) && isFinished(project.status));
}

// ---- Gate ----

export const CHECKLIST_KEYS = ['name', 'result', 'step', 'finished'] as const;
export type ProjectsChecklistKey = (typeof CHECKLIST_KEYS)[number];

function itemMet(project: Project): ChecklistMet<ProjectsChecklistKey> {
  return {
    name: hasText(project.name),
    result: hasText(project.desiredResult),
    step: filledSteps(project).length > 0,
    finished: project.status === 'done',
  };
}

/** One map for the button and its checklist: the counted project closest to passing. */
function checklistMet(list: readonly Project[]): ChecklistMet<ProjectsChecklistKey> {
  return closestMet(countedProjects(list), CHECKLIST_KEYS, itemMet);
}

/** "Mark done" is enabled once a counted project is named, has a desired result, a step and is
 * Done. */
export function isComplete(list: readonly Project[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(list));
}

export function doneChecklist(
  list: readonly Project[],
  labels: ChecklistLabels<ProjectsChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(list), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<ProjectsChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<ProjectsChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

// ---- Rows ----

/** Already-translated labels and formatters, built by the page (playbook §6). */
export interface ProjectLabels {
  readonly example: string;
  /** "Overdue", read before the title of an overdue row. */
  readonly overdue: string;
  /** "2 of 5 steps", plural-correct and in the active numerals. */
  readonly progress: (done: number, total: number) => string;
  readonly formatDate: (date: string) => string;
}

/** The subtitle: "2 of 5 steps" once there is a step, then the deadline when set. */
export function rowSubtitle(project: Project, labels: ProjectLabels): string {
  const { done, total } = progress(project);
  return [
    total > 0 ? labels.progress(done, total) : '',
    project.deadline ? labels.formatDate(project.deadline) : '',
  ]
    .filter((part) => part !== '')
    .join(' · ');
}

/** A row: the name as title, progress and deadline beneath, "Example" on a sample, and a warning
 * with a hidden "Overdue:" prefix when the deadline has passed. A sample is never overdue or
 * done. */
export function toListItem(
  project: Project,
  today: string,
  labels: ProjectLabels,
): ExerciseListItem {
  const subtitle = rowSubtitle(project, labels);
  const warning = !project.sample && isOverdue(project, today);
  return {
    id: project.id,
    title: project.name.trim().replace(/\s+/g, ' '),
    ...(subtitle ? { subtitle } : {}),
    ...(project.sample ? { chips: [{ label: labels.example }] } : {}),
    done: !project.sample && isItemComplete(project),
    ...(warning ? { warning, warningLabel: `${labels.overdue}:` } : {}),
  };
}

// ---- Edits ----

const cleanDate = (date: string | undefined): string | undefined =>
  date !== undefined && isValidIsoDate(date) ? date : undefined;

/** A form edit as stored fields: an emptied or invalid deadline or step date is dropped (absent,
 * never `''`), an emptied desired result too. The page runs every edit through this before
 * `draft.edit()`; the dropped fields come out as `undefined`, which `insertProject()` and
 * `editProject()` both strip, so the draft path stores the same shape as a saved edit (playbook
 * §6's first pitfall). Criteria pass as they are: the form never adds past `MAX_CRITERIA`. */
export function editFields(edit: Partial<ProjectFields>): Partial<ProjectFields> {
  const fields: Record<string, unknown> = { ...edit };
  if ('deadline' in edit) {
    fields['deadline'] = cleanDate(edit.deadline);
  }
  if ('desiredResult' in edit && !hasText(edit.desiredResult)) {
    fields['desiredResult'] = undefined;
  }
  if (edit.steps !== undefined) {
    fields['steps'] = edit.steps.map((step) => {
      const date = cleanDate(step.date);
      return date === undefined
        ? { key: step.key, text: step.text, done: step.done }
        : { key: step.key, text: step.text, done: step.done, date };
    });
  }
  return fields as Partial<ProjectFields>;
}

const sameValue = (a: unknown, b: unknown): boolean =>
  typeof a === 'object' && a !== null && typeof b === 'object' && b !== null
    ? JSON.stringify(a) === JSON.stringify(b)
    : a === b;

function withoutUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

/** Appends `record`, its `undefined` fields left out (the draft before record and guide samples,
 * issue #217 and #232); the same array when its id is already there. */
export function insertProject(list: readonly Project[], record: Project): readonly Project[] {
  return list.some((item) => item.id === record.id) ? list : [...list, withoutUndefined(record)];
}

/** Merges `fields` (cleaned) into the live project `id`, bumping `updatedAt` and making a sample
 * the user's own (issue #232). The same array when `id` isn't live or nothing changes. */
export function editProject(
  list: readonly Project[],
  id: string,
  fields: Partial<ProjectFields>,
  now: Date,
): readonly Project[] {
  const index = list.findIndex((item) => item.id === id && isLive(item));
  if (index < 0) {
    return list;
  }
  const item = list[index];
  const cleaned = editFields(fields);
  const changed = (Object.keys(cleaned) as (keyof ProjectFields)[]).some(
    (key) => !sameValue(item[key], cleaned[key]),
  );
  if (!changed) {
    return list;
  }
  const next = [...list];
  next[index] = touch(withoutSample(withoutUndefined({ ...item, ...cleaned })), now);
  return next;
}

/** Tombstones `id` (never removed); the same array when it isn't live. */
export function removeProject(list: readonly Project[], id: string, now: Date): readonly Project[] {
  return list.some((item) => item.id === id && isLive(item))
    ? list.map((item) => (item.id === id ? softDelete(item, now) : item))
    : list;
}

/** Undoes `removeProject()`; the same array when `id` isn't deleted. */
export function restoreProject(
  list: readonly Project[],
  id: string,
  now: Date,
): readonly Project[] {
  return list.some((item) => item.id === id && !isLive(item))
    ? list.map((item) =>
        item.id === id ? touch(withoutUndefined({ ...item, deletedAt: undefined }), now) : item,
      )
    : list;
}

// ---- Samples ----

/** Days from creation to a sample's deadline (issue #65: today + 14, never a stored date). */
export const SAMPLE_DEADLINE_IN_DAYS = 14;

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

function sampleSteps(value: unknown, newKey: () => string): ProjectStep[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry: unknown) => {
    const step =
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
    const text = optionalText(step['text']);
    return text === undefined ? [] : [{ key: newKey(), text, done: step['done'] === true }];
  });
}

/** A guide example's `sample` payload as a new project's fields, or `null` when it isn't valid
 * (the i18n JSON is an input boundary). `deadline: true` sets the deadline `SAMPLE_DEADLINE_IN_DAYS`
 * after `today`; each step gets a key from `newKey`. The caller adds `sample: true`. */
export function projectFromExample(
  value: unknown,
  today: string,
  newKey: () => string,
): ProjectFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const name = optionalText(example['name']);
  const status = example['status'];
  if (name === undefined || !isProjectStatus(status)) {
    return null;
  }
  const desiredResult = optionalText(example['desiredResult']);
  const criteria = Array.isArray(example['criteria'])
    ? example['criteria'].filter((line): line is string => optionalText(line) !== undefined)
    : [];
  return {
    name,
    ...(desiredResult === undefined ? {} : { desiredResult }),
    criteria: criteria.slice(0, MAX_CRITERIA),
    ...(example['deadline'] === true ? { deadline: addDays(today, SAMPLE_DEADLINE_IN_DAYS) } : {}),
    steps: sampleSteps(example['steps'], newKey),
    status,
  };
}

/** The live, untouched sample made from this example, if the user already tried it: trying it
 * again opens that one instead of adding a copy (issue #232). */
export function liveSampleOf(
  list: readonly Project[],
  fields: Pick<ProjectFields, 'name'>,
): Project | undefined {
  return list.find((item) => isLive(item) && item.sample && item.name === fields.name);
}
