import { isLive, softDelete, touch } from '../../core/data/record';
import {
  ChecklistLabels,
  ChecklistMet,
  allMet,
  checklistItems,
  checklistLabels,
  closestMet,
  labelsLoaded,
} from '../../shared/exercise-kit/done-checklist.logic';
import type { DoneChecklistItem } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseHubStatus } from '../../shared/exercise-kit/exercise-registry';
import type { AssessmentHistoryItem } from '../../shared/exercise-kit/assessment-history.logic';
import type { LongView, LongViewAnswer, LongViewFields, LongViewScenario } from './long-view.model';

/** The prompt keys of each long view, in step order (issue #58's Content). Labels, prompts and
 * placeholders are translated from these keys; none is stored. */
export const PROMPTS: Readonly<Record<LongViewScenario, readonly string[]>> = {
  funeral: ['funeral.family', 'funeral.friend', 'funeral.work', 'funeral.community'],
  oneYear: ['oneYear.who', 'oneYear.stop', 'oneYear.finish'],
  anniversary: ['anniversary.which', 'anniversary.built', 'anniversary.said'],
  lastDay: ['lastDay.contributed', 'lastDay.next'],
};

/** How many long views there are: the "of 4" in "2 of 4 long views". */
export const SCENARIO_TOTAL = Object.keys(PROMPTS).length;

/** The funeral's speaker slot for a prompt key (`speaker.family`), `null` for any other prompt. */
export function speakerSlot(promptKey: string): string | null {
  return promptKey.startsWith('funeral.') ? promptKey.slice('funeral.'.length) : null;
}

/** A new long view of `scenario`: one empty answer per prompt, dated `date`. */
export function newLongViewFields(scenario: LongViewScenario, date: string): LongViewFields {
  return {
    scenario,
    date,
    answers: PROMPTS[scenario].map((promptKey) => ({ promptKey, text: '', values: [] })),
  };
}

const hasText = (value: string | undefined): boolean => (value ?? '').trim() !== '';

/** The answer to `promptKey`, an empty one if the record has none (an imported record may). */
export function answerFor(view: LongView, promptKey: string): LongViewAnswer {
  return (
    view.answers.find((answer) => answer.promptKey === promptKey) ?? {
      promptKey,
      text: '',
      values: [],
    }
  );
}

/** `view`'s answers with `promptKey`'s replaced by `fields` merged in, in prompt order. */
export function withAnswer(
  view: LongView,
  promptKey: string,
  fields: Partial<Omit<LongViewAnswer, 'promptKey'>>,
): readonly LongViewAnswer[] {
  const answers = PROMPTS[view.scenario].map((key) => answerFor(view, key));
  return answers.map((answer) =>
    answer.promptKey === promptKey ? { ...answer, ...fields } : answer,
  );
}

/** Adds `value` (trimmed) to `values`, unless it is empty or already there (case-insensitive). */
export function addValue(values: readonly string[], value: string): readonly string[] {
  const trimmed = value.trim();
  if (trimmed === '' || values.some((existing) => sameValue(existing, trimmed))) {
    return values;
  }
  return [...values, trimmed];
}

export function removeValue(values: readonly string[], value: string): readonly string[] {
  return values.filter((existing) => existing !== value);
}

const sameValue = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Every value chip of one long view, deduplicated case-insensitively, first spelling kept. */
export function scenarioValues(view: LongView): readonly string[] {
  return view.answers.reduce<readonly string[]>(
    (values, answer) => answer.values.reduce(addValue, values),
    [],
  );
}

/** Draft before record (issue #217): typed answer text, a speaker edit or a chip. */
export function isDraftWorthSaving(view: LongView): boolean {
  return view.answers.some(
    (answer) => hasText(answer.text) || answer.speaker !== undefined || answer.values.length > 0,
  );
}

/** The three gate items (issue #58), in the order the user meets them. */
export const CHECKLIST_KEYS = ['scenario', 'answers', 'value'] as const;
export type LongViewChecklistKey = (typeof CHECKLIST_KEYS)[number];

function checklistMet(view: LongView): ChecklistMet<LongViewChecklistKey> {
  return {
    scenario: true,
    answers: PROMPTS[view.scenario].every((key) => hasText(answerFor(view, key).text)),
    value: view.answers.some((answer) => answer.values.some((value) => hasText(value))),
  };
}

/** Every prompt has text and the long view holds at least one value chip. */
export function isComplete(view: LongView): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(view));
}

export function liveLongViews(list: readonly LongView[]): LongView[] {
  return list.filter(isLive);
}

export function isStarted(list: readonly LongView[]): boolean {
  return list.some(isLive);
}

/** "Mark done" is enabled once one live long view is complete. */
export function canMarkDone(list: readonly LongView[]): boolean {
  return liveLongViews(list).some(isComplete);
}

export function doneChecklist(
  list: readonly LongView[],
  labels: ChecklistLabels<LongViewChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(
    CHECKLIST_KEYS,
    closestMet(liveLongViews(list), CHECKLIST_KEYS, checklistMet),
    labels,
  );
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<LongViewChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

export function checklistLoaded(labels: ChecklistLabels<LongViewChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

export interface ValueHeard {
  readonly value: string;
  readonly count: number;
}

/**
 * The values heard across every live long view: trimmed, deduplicated case-insensitively with the
 * first spelling kept, `count` = how many long views hold it; most heard first, then alphabetical.
 */
export function valuesHeard(list: readonly LongView[]): readonly ValueHeard[] {
  const heard = new Map<string, { value: string; count: number }>();
  for (const view of liveLongViews(list)) {
    for (const value of scenarioValues(view)) {
      const key = value.toLowerCase();
      const entry = heard.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        heard.set(key, { value, count: 1 });
      }
    }
  }
  return [...heard.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Distinct scenarios with a complete live long view. */
export function completedScenarios(list: readonly LongView[]): readonly LongViewScenario[] {
  const complete = new Set(
    liveLongViews(list)
      .filter(isComplete)
      .map((view) => view.scenario),
  );
  return [...complete];
}

/** The hub's status: "2 of 4 long views", `null` before one is complete. */
export function hubStatus(list: readonly LongView[]): ExerciseHubStatus | null {
  const count = completedScenarios(list).length;
  return count > 0 ? { key: 'habits.exercises.h2-long-view.scenarioCount', count } : null;
}

/** One history row: the scenario's (already translated) title, the date and the value count. */
export function historyItems(
  history: readonly LongView[],
  scenarioLabels: Readonly<Record<LongViewScenario, string>>,
): AssessmentHistoryItem[] {
  return history.map((view) => ({
    id: view.id,
    date: view.date,
    label: scenarioLabels[view.scenario],
    summary: { key: 'h2LongView.list.valueCountText', count: scenarioValues(view).length },
  }));
}

/** `translateSignal`'s array output keyed like `keys`, `''` per key before the scope loads
 * (playbook §6: an array key starts at `['']`). */
export function labelsByKey<K extends string>(
  keys: readonly K[],
  translated: readonly (string | undefined)[],
): Readonly<Record<K, string>> {
  return Object.fromEntries(keys.map((key, index) => [key, translated[index] ?? ''])) as Record<
    K,
    string
  >;
}

/** Every prompt key of every scenario, then the closing step: what the stepper labels cover. */
export const STEP_KEYS: readonly string[] = [...Object.values(PROMPTS).flat(), 'readBack'];

/** Merges `fields` into the live long view `id` and bumps its `updatedAt`. */
export function editLongView(
  list: readonly LongView[],
  id: string,
  fields: Partial<LongViewFields>,
  now: Date,
): LongView[] {
  return list.map((view) =>
    view.id === id && isLive(view) ? touch({ ...view, ...fields }, now) : view,
  );
}

/** Tombstones the long view `id` (issue #203's delete pattern). */
export function removeLongView(list: readonly LongView[], id: string, now: Date): LongView[] {
  return list.map((view) => (view.id === id ? softDelete(view, now) : view));
}

/** Undoes `removeLongView()`. */
export function restoreLongView(list: readonly LongView[], id: string, now: Date): LongView[] {
  return list.map((view) =>
    view.id === id && !isLive(view) ? touch({ ...view, deletedAt: undefined }, now) : view,
  );
}
