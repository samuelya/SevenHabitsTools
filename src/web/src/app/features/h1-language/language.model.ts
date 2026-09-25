import { BaseRecord } from '../../core/data/record';
import {
  isArrayOf,
  isBaseRecord,
  isOneOf,
  isOptionalBoolean,
  isOptionalString,
} from '../../core/data/record-validators';
import { getRegisteredModels, registerModel } from '../../core/data/registry';
import { registerExercise } from '../../shared/exercise-kit/exercise-registry';
import { storeStatusFactory } from '../../shared/exercise-kit/exercise-hub-status';
import { storeStartedFactory } from '../../shared/exercise-kit/exercise-started';
import { hubStatus, isStarted } from './language.logic';

/** Which kind a phrase is (issue #54): Giving away the choice / Owning the choice. Stored as a
 * key, translated at render (architecture issue #1 §6). */
export const PHRASE_KINDS = ['reactive', 'proactive'] as const;
export type PhraseKind = (typeof PHRASE_KINDS)[number];

/** One phrase the user caught themselves saying (issue #54). The time is `createdAt`. */
export interface Phrase extends BaseRecord {
  readonly text: string;
  readonly kind: PhraseKind;
  /** The rewrite as a choice; only shown and counted for a `reactive` phrase. */
  readonly reframe?: string;
  /** Where. */
  readonly context?: string;
  /** The listening day running when the phrase was added, if one was. */
  readonly listeningDayId?: string;
  /** A copy of a guide example ("Try this example", issue #232): counts toward nothing until the
   * user edits it. Absent means `false`. */
  readonly sample?: boolean;
}

export type PhraseFields = Omit<Phrase, keyof BaseRecord>;

/** A listening day (issue #54): running while `!endedAt && now < startedAt + 24 h`
 * (`isRunning()` in `language.logic.ts`). Reaching the 24 hours stores nothing; only "End day"
 * sets `endedAt`. */
export interface ListeningDay extends BaseRecord {
  /** ISO datetime. */
  readonly startedAt: string;
  /** ISO datetime, set by "End day". */
  readonly endedAt?: string;
}

/** The stored value: a day and its phrases are one exercise, so both arrays sit under one key
 * (lead decision on #54). */
export interface LanguageLog {
  readonly phrases: readonly Phrase[];
  readonly listeningDays: readonly ListeningDay[];
}

/** The model key `featureStore<LanguageLog>()` callers resolve, and this exercise's `exerciseId`. */
export const LANGUAGE_MODEL_KEY = 'h1-language';

/** The document path this model lives at (issue #54's data model). */
export const LANGUAGE_PATH = 'habits.h1.language';

/** This exercise's mounted URL (`route-registry.ts`, and `registerExercise()`'s `route` below). */
export const LANGUAGE_ROUTE = 'habits/h1/language';

export const isPhraseKind = isOneOf(PHRASE_KINDS);

function isPhrase(value: unknown): value is Phrase {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate['text'] === 'string' &&
    isPhraseKind(candidate['kind']) &&
    isOptionalString(candidate['reframe']) &&
    isOptionalString(candidate['context']) &&
    isOptionalString(candidate['listeningDayId']) &&
    isOptionalBoolean(candidate['sample'])
  );
}

/** `YYYY-MM-DDTHH:mm[:ss[.sss]]` with `Z` or an offset, as `Date.toISOString()` writes it. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** A parseable ISO datetime: an imported `startedAt: "garbage"` would otherwise read as a day that
 * has ended and meet the "day" checklist item. */
function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}

function isListeningDay(value: unknown): value is ListeningDay {
  if (!isBaseRecord(value)) {
    return false;
  }
  const candidate = value as unknown as Record<string, unknown>;
  return (
    isIsoDateTime(candidate['startedAt']) &&
    (candidate['endedAt'] === undefined || isIsoDateTime(candidate['endedAt']))
  );
}

const isPhraseArray = isArrayOf(isPhrase);
const isListeningDayArray = isArrayOf(isListeningDay);

/** Structure and enums only (playbook §3): a phrase naming a day that no longer exists is fine. */
function isLanguageLog(value: unknown): value is LanguageLog {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const log = value as Record<string, unknown>;
  return isPhraseArray(log['phrases']) && isListeningDayArray(log['listeningDays']);
}

/** Registers the `h1-language` model and exercise, a no-op if already done (Vitest runs with
 * `isolate: false`). */
export function registerLanguageModel(): void {
  if (getRegisteredModels().some((model) => model.key === LANGUAGE_MODEL_KEY)) {
    return;
  }
  registerModel<LanguageLog>({
    key: LANGUAGE_MODEL_KEY,
    path: LANGUAGE_PATH,
    defaults: () => ({ phrases: [], listeningDays: [] }),
    validate: isLanguageLog,
  });
  registerExercise({
    exerciseId: LANGUAGE_MODEL_KEY,
    habit: 'h1',
    titleKey: 'habits.exercises.h1-language.title',
    shortTitleKey: 'habits.exercises.h1-language.shortTitle',
    icon: 'record_voice_over',
    route: LANGUAGE_ROUTE,
    order: 10,
    isStarted: storeStartedFactory<LanguageLog>(LANGUAGE_MODEL_KEY, isStarted),
    statusFactory: storeStatusFactory<LanguageLog>(LANGUAGE_MODEL_KEY, hubStatus),
  });
}

registerLanguageModel();
