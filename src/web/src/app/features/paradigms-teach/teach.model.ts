import { Signal, computed, signal } from '@angular/core';
import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalString,
} from '../../core/data/record-validators';
import { featureStore } from '../../core/data/feature-store';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import {
  ExerciseHubStatus,
  getRegisteredExercises,
  registerExercise,
} from '../../shared/exercise-kit/exercise-registry';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import {
  getRegisteredHubActions,
  registerHubAction,
} from '../../shared/exercise-kit/hub-action-registry';
import { isStarted, sharedCount } from './teach.logic';

/** The ten book chapters a "teach it" commitment can be made for (issue #52's "Implementation
 * notes"): the nine habit hubs plus "Inside-Out Again", which has no habit hub of its own. Stored
 * as a key, never translated text (architecture issue #1 §6). */
export const TEACH_CHAPTERS = [
  'paradigms',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'h7',
  'interdependence',
  'insideOutAgain',
] as const;
export type TeachChapter = (typeof TEACH_CHAPTERS)[number];

/** Whether the user has shared the chapter's key idea yet. */
export const TEACH_STATUSES = ['planned', 'shared', 'skipped'] as const;
export type TeachStatus = (typeof TEACH_STATUSES)[number];

/**
 * One chapter's "teach it to learn it" commitment (issue #52). At most one live entry per
 * `chapter` (`teach.logic.ts`'s `upsertEntry()` enforces this); `keyIdea` is the user's own
 * paraphrase of the chapter, required and ≤ 280 chars — form validation, not `validate()`
 * (architecture issue #1 §6: "checks structure, not business rules"). `plannedAt` defaults to
 * today + 2 days; `sharedAt` is stamped from `CLOCK` the first time `status` becomes `'shared'`.
 */
export interface TeachEntry extends BaseRecord {
  readonly chapter: TeachChapter;
  readonly keyIdea: string;
  readonly person?: string;
  readonly plannedAt: string;
  readonly sharedAt?: string;
  readonly status: TeachStatus;
  readonly learned?: string;
}

/** The fields a caller supplies when creating or editing an entry; base record fields come from
 * `newRecord()`. */
export type TeachEntryFields = Omit<TeachEntry, keyof BaseRecord>;

/** The model key `featureStore<TeachEntry[]>()` callers resolve, and this exercise's `exerciseId`
 * (playbook §1: the model key is always the `exerciseId`). */
export const TEACH_MODEL_KEY = 'paradigms-teach';

/** The document path this model lives at (issue #52's data model). */
export const TEACH_PATH = 'habits.paradigms.teach';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below) —
 * shared with `teach-page.ts`'s own navigation so the two can never drift apart. */
export const TEACH_ROUTE = 'habits/paradigms/teach';

/** Guards a route query param (e.g. a "teach this" deep link's `?chapter=`) against the fixed
 * chapter keys. */
export const isTeachChapter = isOneOf(TEACH_CHAPTERS);
const isTeachStatus = isOneOf(TEACH_STATUSES);

function isTeachEntry(value: unknown): value is TeachEntry {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    isTeachChapter(candidate['chapter']) &&
    typeof candidate['keyIdea'] === 'string' &&
    isOptionalString(candidate['person']) &&
    typeof candidate['plannedAt'] === 'string' &&
    isOptionalString(candidate['sharedAt']) &&
    isTeachStatus(candidate['status']) &&
    isOptionalString(candidate['learned'])
  );
}

const isTeachEntryArray = isArrayOf(isTeachEntry);

/**
 * Registers the `paradigms-teach` model, exercise and hub action — three independent registries,
 * each guarded on its own key rather than one guard for all three. Vitest here runs with
 * `isolate: false` (shared module state across spec files), and a spec that resets one registry
 * (e.g. `resetExerciseRegistryForTesting()`) without also resetting the others would otherwise
 * leave this a permanent no-op for whichever registry got cleared, since the single guard's
 * `getRegisteredModels()` check would still see the model and skip re-registering everything
 * (review finding on #52's PR).
 */
export function registerTeachModel(): void {
  if (!getRegisteredModels().some((model) => model.key === TEACH_MODEL_KEY)) {
    registerModel<TeachEntry[]>({
      key: TEACH_MODEL_KEY,
      path: TEACH_PATH,
      defaults: () => [],
      validate: isTeachEntryArray,
    });
  }
  if (!getRegisteredExercises().some((exercise) => exercise.exerciseId === TEACH_MODEL_KEY)) {
    registerExercise({
      exerciseId: TEACH_MODEL_KEY,
      habit: 'paradigms',
      titleKey: 'habits.exercises.paradigms-teach.title',
      summaryKey: 'habits.exercises.paradigms-teach.summary',
      icon: 'campaign',
      route: TEACH_ROUTE,
      isStarted: storeStartedFactory<TeachEntry[]>(TEACH_MODEL_KEY, isStarted),
      statusFactory: (): Signal<ExerciseHubStatus | null> => {
        // Defensive, not just idempotent: this factory runs later, lazily, from the hub page's own
        // `runInInjectionContext()` call at render time — a spec that reset the model registry
        // without this feature's own model surviving (or re-registering) would otherwise throw
        // *during change detection* instead of at a registration call this file controls (review
        // finding on #52's PR).
        if (!getRegisteredModels().some((model) => model.key === TEACH_MODEL_KEY)) {
          return signal(null);
        }
        const store = featureStore<TeachEntry[]>(TEACH_MODEL_KEY);
        return computed(() => {
          const count = sharedCount(store.value());
          return count > 0 ? { key: 'habits.exercises.paradigms-teach.sharedCount', count } : null;
        });
      },
    });
  }
  // "Teach this" (issue #52): every habit hub gets a shortcut to this exercise, pre-selecting the
  // chapter that matches the hub it's shown on. `queryParams` is generic (`hub-action-registry.ts`
  // just forwards the current `HabitId`) — this feature is the only thing that knows the query
  // param is named `chapter` and that a `HabitId` is also one of `TEACH_CHAPTERS`.
  if (!getRegisteredHubActions().some((action) => action.id === TEACH_MODEL_KEY)) {
    registerHubAction({
      id: TEACH_MODEL_KEY,
      labelKey: 'habits.exercises.paradigms-teach.hubActionLabel',
      icon: 'campaign',
      route: TEACH_ROUTE,
      queryParams: (habit) => ({ chapter: habit }),
    });
  }
}

registerTeachModel();
