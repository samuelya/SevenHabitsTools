import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { isValidIsoDate } from '../exercise-kit/assessment-history.logic';

/** A project's status (issue #65), in display order. Planning and Under way are "under way";
 * Done and Dropped are "finished". */
export const PROJECT_STATUSES = ['planning', 'underWay', 'done', 'dropped'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** "Five is enough": the most "How you'll know" lines a project holds. The form stops adding at
 * this and `validate()` rejects more, so an edit never has to cut lines. */
export const MAX_CRITERIA = 5;

/** One step: a nested value object edited only through its project (playbook §3), in order. `key`
 * is the stable `track` value and what the weekly planner (#71) refers to: non-empty and unique
 * within its project. */
export interface ProjectStep {
  readonly key: string;
  readonly text: string;
  readonly done: boolean;
  /** A local date, `YYYY-MM-DD`. */
  readonly date?: string;
}

/** One project (issue #65): the name, what done looks like, how you'll know (success criteria),
 * an optional deadline, the steps and a status. Written only through `ProjectsService`. */
export interface Project extends BaseRecord {
  readonly name: string;
  /** "What done looks like": the steps open once it has text. */
  readonly desiredResult?: string;
  /** "How you'll know", at most `MAX_CRITERIA` lines. */
  readonly criteria: readonly string[];
  /** A local date, `YYYY-MM-DD`. */
  readonly deadline?: string;
  readonly steps: readonly ProjectStep[];
  readonly status: ProjectStatus;
  /** A copy of a guide example (issue #232), counted toward nothing until its first edit. */
  readonly sample?: boolean;
}

export type ProjectFields = Omit<Project, keyof BaseRecord>;

/** The model key, also the exercise's id (playbook §1). */
export const PROJECTS_MODEL_KEY = 'h2-projects';

export const PROJECTS_PATH = 'habits.h2.projects';

const isOptionalDate = (value: unknown): boolean =>
  value === undefined || (typeof value === 'string' && isValidIsoDate(value));

export const isProjectStatus = isOneOf(PROJECT_STATUSES);

function isStep(value: unknown): value is ProjectStep {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['key'] === 'string' &&
    candidate['key'] !== '' &&
    typeof candidate['text'] === 'string' &&
    typeof candidate['done'] === 'boolean' &&
    isOptionalDate(candidate['date'])
  );
}

const isStepArray = isArrayOf(isStep);

/** Steps with non-empty keys, no two alike: a key names one step for `track` and the planner. */
function isSteps(value: unknown): value is readonly ProjectStep[] {
  return isStepArray(value) && new Set(value.map((step) => step.key)).size === value.length;
}

const isCriteriaArray = isArrayOf((value: unknown): value is string => typeof value === 'string');

function isCriteria(value: unknown): value is readonly string[] {
  return isCriteriaArray(value) && value.length <= MAX_CRITERIA;
}

function isProject(value: unknown): value is Project {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['name'] === 'string' &&
    isOptionalString(candidate['desiredResult']) &&
    isCriteria(candidate['criteria']) &&
    isOptionalDate(candidate['deadline']) &&
    isSteps(candidate['steps']) &&
    isProjectStatus(candidate['status']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isProjectArray = isArrayOf(isProject);

/**
 * Registers the `h2-projects` model, a no-op if already done (Vitest runs with `isolate: false`).
 * Imported eagerly from `model-registry.ts`, like `shared/roles/`, because the weekly planner (#71)
 * reads the steps whether or not the Projects page was ever opened. The exercise's hub entry is
 * registered by `features/h2-projects/projects.model.ts`.
 */
export function registerProjectsModel(): void {
  if (getRegisteredModels().some((model) => model.key === PROJECTS_MODEL_KEY)) {
    return;
  }
  registerModel<Project[]>({
    key: PROJECTS_MODEL_KEY,
    path: PROJECTS_PATH,
    defaults: () => [],
    validate: isProjectArray,
  });
}

registerProjectsModel();
