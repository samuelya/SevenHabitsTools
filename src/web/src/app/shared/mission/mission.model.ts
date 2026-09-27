import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { isValidIsoDate } from '../exercise-kit/assessment-history.logic';

/** The five review questions of step 6 (issue #61), stored as keys, translated at render. */
export const REVIEW_KEYS = ['roles', 'beAndDo', 'principles', 'ownWords', 'gladToLive'] as const;
export type ReviewKey = (typeof REVIEW_KEYS)[number];

/** How often the statement asks to be reread (#62 writes it; declared here so #62 adds no field). */
export const REVIEW_INTERVALS = ['monthly', 'quarterly', 'yearly', 'off'] as const;
export type ReviewInterval = (typeof REVIEW_INTERVALS)[number];

/** The two free lists of step 4. */
export type MissionLineList = 'toBe' | 'toDo';

/** One role's line (step 3), a nested value object: labelled at render through
 * `RolesService.byId()`, so a renamed role keeps its line. */
export interface MissionRoleLine {
  readonly roleId: string;
  readonly text: string;
}

/** A saved statement (step 6), a nested value object: append-only, oldest first. `note` is #62's. */
export interface MissionVersion {
  readonly id: string;
  /** ISO timestamp. */
  readonly savedAt: string;
  readonly text: string;
  readonly note?: string;
}

/** The review rhythm, written by #62 only. Dates are `YYYY-MM-DD`. */
export interface MissionReview {
  readonly interval: ReviewInterval;
  readonly nextAt?: string;
  readonly lastReviewedAt?: string;
}

/**
 * The personal mission statement (issue #61): one worksheet record, created on the first edit and
 * written only through `MissionService`. `values` and `principles` are strings copied at selection,
 * so a later edit in Your long view or Your centre never rewrites them. The shape is final for #62
 * too (`versions`, `review`).
 */
export interface Mission extends BaseRecord {
  readonly values: readonly string[];
  readonly principles: readonly string[];
  readonly roleLines: readonly MissionRoleLine[];
  readonly toBe: readonly string[];
  readonly toDo: readonly string[];
  readonly draft: string;
  readonly checklist: Readonly<Partial<Record<ReviewKey, boolean>>>;
  readonly versions: readonly MissionVersion[];
  readonly review?: MissionReview;
}

export type MissionFields = Omit<Mission, keyof BaseRecord>;

/** The model key, and the exercise id of the page that edits it (playbook §1). */
export const MISSION_MODEL_KEY = 'h2-mission';

export const MISSION_PATH = 'habits.h2.mission';

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = isArrayOf(isString);
const isReviewInterval = isOneOf(REVIEW_INTERVALS);
const isReviewKey = isOneOf(REVIEW_KEYS);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A real ISO timestamp (what `Date.toISOString()` writes); an imported `''` is rejected. */
function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !isNaN(Date.parse(value));
}

function isOptionalIsoDate(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && isValidIsoDate(value));
}

function isRoleLine(value: unknown): value is MissionRoleLine {
  return isObject(value) && isString(value['roleId']) && isString(value['text']);
}

function isVersion(value: unknown): value is MissionVersion {
  return (
    isObject(value) &&
    isString(value['id']) &&
    isTimestamp(value['savedAt']) &&
    isString(value['text']) &&
    isOptionalString(value['note'])
  );
}

function isChecklist(value: unknown): value is Mission['checklist'] {
  return (
    isObject(value) &&
    Object.entries(value).every(([key, answer]) => isReviewKey(key) && typeof answer === 'boolean')
  );
}

function isOptionalReview(value: unknown): value is MissionReview | undefined {
  return (
    value === undefined ||
    (isObject(value) &&
      isReviewInterval(value['interval']) &&
      isOptionalIsoDate(value['nextAt']) &&
      isOptionalIsoDate(value['lastReviewedAt']))
  );
}

const isRoleLineArray = isArrayOf(isRoleLine);
const isVersionArray = isArrayOf(isVersion);

export function isMission(value: unknown): value is Mission {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    isStringArray(candidate['values']) &&
    isStringArray(candidate['principles']) &&
    isRoleLineArray(candidate['roleLines']) &&
    isStringArray(candidate['toBe']) &&
    isStringArray(candidate['toDo']) &&
    isString(candidate['draft']) &&
    isChecklist(candidate['checklist']) &&
    isVersionArray(candidate['versions']) &&
    isOptionalReview(candidate['review'])
  );
}

/**
 * Registers the `h2-mission` model, a no-op if already done (Vitest runs with `isolate: false`).
 * Imported eagerly from `model-registry.ts` ("Shared entities"), not from the lazy route, so the
 * slice is validated on load and import even when the Mission page has never been opened: the
 * weekly planner (#71) and the dashboard (#97) read the statement too.
 */
export function registerMissionModel(): void {
  if (getRegisteredModels().some((model) => model.key === MISSION_MODEL_KEY)) {
    return;
  }
  registerModel<Mission | null>({
    key: MISSION_MODEL_KEY,
    path: MISSION_PATH,
    defaults: () => null,
    validate: (value) => value === null || isMission(value),
  });
}

registerMissionModel();
