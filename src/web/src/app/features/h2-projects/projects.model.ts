import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { isValidIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';
import { storeStatusFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from './projects.logic';

/** A project's status (issue #65), in display order. Planning and Under way are "under way";
 * Done and Dropped are "finished". */
export const PROJECT_STATUSES = ['planning', 'underWay', 'done', 'dropped'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** One step: a nested value object edited only through its project (playbook §3), in order. `key`
 * is the stable `track` value and what the weekly planner (#71) refers to. */
export interface ProjectStep {
  readonly key: string;
  readonly text: string;
  readonly done: boolean;
  /** A local date, `YYYY-MM-DD`. */
  readonly date?: string;
}

/** One project (issue #65): the name, what done looks like, how you'll know (success criteria),
 * an optional deadline, the steps and a status. */
export interface Project extends BaseRecord {
  readonly name: string;
  /** "What done looks like": the steps open once it has text. */
  readonly desiredResult?: string;
  /** "How you'll know", at most five lines (a form rule, not checked by `validate()`). */
  readonly criteria: readonly string[];
  /** A local date, `YYYY-MM-DD`. */
  readonly deadline?: string;
  readonly steps: readonly ProjectStep[];
  readonly status: ProjectStatus;
  /** A copy of a guide example (issue #232), counted toward nothing until its first edit. */
  readonly sample?: boolean;
}

export type ProjectFields = Omit<Project, keyof BaseRecord>;

/** The model key and `exerciseId` (playbook §1). */
export const PROJECTS_MODEL_KEY = 'h2-projects';

export const PROJECTS_PATH = 'habits.h2.projects';

/** This exercise's mounted URL (`route-registry.ts` and `registerExercise()`). */
export const PROJECTS_ROUTE = 'habits/h2/projects';

const isOptionalDate = (value: unknown): boolean =>
  value === undefined || (typeof value === 'string' && isValidIsoDate(value));

const isStatus = isOneOf(PROJECT_STATUSES);

function isStep(value: unknown): value is ProjectStep {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['key'] === 'string' &&
    typeof candidate['text'] === 'string' &&
    typeof candidate['done'] === 'boolean' &&
    isOptionalDate(candidate['date'])
  );
}

const isSteps = isArrayOf(isStep);
const isCriteria = isArrayOf((value: unknown): value is string => typeof value === 'string');

function isProject(value: unknown): value is Project {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['name'] === 'string' &&
    (candidate['desiredResult'] === undefined || typeof candidate['desiredResult'] === 'string') &&
    isCriteria(candidate['criteria']) &&
    isOptionalDate(candidate['deadline']) &&
    isSteps(candidate['steps']) &&
    isStatus(candidate['status']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

const isProjectArray = isArrayOf(isProject);

/** Registers the model and the exercise, a no-op if already done (Vitest runs with
 * `isolate: false`). */
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
  registerExercise({
    exerciseId: PROJECTS_MODEL_KEY,
    habit: 'h2',
    titleKey: 'habits.exercises.h2-projects.title',
    shortTitleKey: 'habits.exercises.h2-projects.shortTitle',
    icon: 'flag',
    route: PROJECTS_ROUTE,
    order: 70,
    isStarted: storeStartedFactory<Project[]>(PROJECTS_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<Project[]>(PROJECTS_MODEL_KEY, hubStatus),
  });
}

registerProjectsModel();
