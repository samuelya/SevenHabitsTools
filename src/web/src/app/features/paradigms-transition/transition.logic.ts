import { softDelete, touch, isLive } from '../../core/data/record';
import { isOneOf } from '../../core/data/record-validators';
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
import {
  ExerciseListChip,
  ExerciseListItem,
} from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import {
  SCRIPT_DECISIONS,
  SCRIPT_EFFECTS,
  SCRIPT_SOURCES,
  Script,
  ScriptDecision,
  ScriptEffect,
  ScriptFields,
  ScriptSource,
} from './transition.model';

/** A script is complete once it names the pattern and, for `'rewrite'`/`'stop'`, also states the
 * new script and a concrete situation this week where it applies (issue #51's acceptance
 * criteria). `'keep'` needs nothing beyond the text itself. Pure business rule — kept out of
 * `validate()`, which only checks structure (architecture issue #1 §6). */
export function isItemComplete(
  script: Pick<Script, 'text' | 'decision' | 'newScript' | 'situation'>,
): boolean {
  if (!script.text.trim()) {
    return false;
  }
  if (script.decision === 'keep') {
    return true;
  }
  return Boolean(script.newScript?.trim()) && Boolean(script.situation?.trim());
}

/** Live scripts only (architecture issue #1 §6: tombstoned records are never shown). */
export function liveScripts(scripts: readonly Script[]): Script[] {
  return scripts.filter(isLive);
}

/** The live scripts that count toward progress, summaries and the done gate (`isCounted()`). */
export function countedScripts(scripts: readonly Script[]): Script[] {
  return scripts.filter(isCounted);
}

/** Started once any counted script exists (issues #216, #232) — the hub's "started", Today's
 * Continue and the intro card's collapse all read this. */
export function isStarted(scripts: readonly Script[]): boolean {
  return scripts.some(isCounted);
}

/** The hub's in-progress text (issue #219): "3 patterns", one per counted script; `null` with
 * none. */
export function hubStatus(scripts: readonly Script[]): ExerciseHubStatus | null {
  const count = countedScripts(scripts).length;
  return count > 0 ? { key: 'habits.exercises.paradigms-transition.patternCount', count } : null;
}

/** The four gate items (issue #215), in the order the item form asks for them. */
export const CHECKLIST_KEYS = ['pattern', 'decision', 'newScript', 'situation'] as const;
export type TransitionChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** One script's "met" map. `decision` always holds one of the three options (a new script starts
 * at Keep), so "Decide what to do with it" is met as soon as there is a pattern to decide about;
 * the two Rewrite/Stop items are met by a named Keep script. All four met is exactly
 * `isItemComplete()`. */
function scriptMet(script: Script): ChecklistMet<TransitionChecklistKey> {
  const named = Boolean(script.text.trim());
  const needsMore = requiresNewScript(script.decision);
  return {
    pattern: named,
    decision: named,
    newScript: named && (!needsMore || Boolean(script.newScript?.trim())),
    situation: named && (!needsMore || Boolean(script.situation?.trim())),
  };
}

/** The checklist describes the live script closest to complete (`closestMet()`), so "Mark done"
 * and the list it shows reduce the same map and can never disagree. */
function checklistMet(scripts: readonly Script[]): ChecklistMet<TransitionChecklistKey> {
  return closestMet(countedScripts(scripts), CHECKLIST_KEYS, scriptMet);
}

/** Whether `DoneToggle` should be enabled: at least one live script is complete (issue #51's
 * "Implementation notes"), derived from the checklist (issue #215). */
export function isComplete(scripts: readonly Script[]): boolean {
  return allMet(CHECKLIST_KEYS, checklistMet(scripts));
}

/** The gate items, labelled for `DoneToggle` — `labels` from `checklistLabelsFrom()` over a
 * `translateSignal` of `checklist.<key>` (playbook §6 "Reactive labels"). */
export function doneChecklist(
  scripts: readonly Script[],
  labels: ChecklistLabels<TransitionChecklistKey>,
): readonly DoneChecklistItem[] {
  return checklistItems(CHECKLIST_KEYS, checklistMet(scripts), labels);
}

export function checklistLabelsFrom(
  labels: readonly (string | undefined)[],
): ChecklistLabels<TransitionChecklistKey> {
  return checklistLabels(CHECKLIST_KEYS, labels);
}

/** Gates the checklist's rendering until the scope has loaded (no blank rows on a cold visit). */
export function checklistLoaded(labels: ChecklistLabels<TransitionChecklistKey>): boolean {
  return labelsLoaded(CHECKLIST_KEYS, labels);
}

/** The summary card's counts (issue #51's acceptance criteria): how many counted scripts are
 * decided to stop or be rewritten, out of how many counted scripts total (samples excluded,
 * issue #232). */
export interface TransitionSummary {
  readonly stopped: number;
  readonly rewritten: number;
  readonly total: number;
}

export function summarize(scripts: readonly Script[]): TransitionSummary {
  const live = countedScripts(scripts);
  return {
    stopped: live.filter((script) => script.decision === 'stop').length,
    rewritten: live.filter((script) => script.decision === 'rewrite').length,
    total: live.length,
  };
}

/** Already-translated labels for each enum's options, built by the page from its own Transloco
 * scope — kept out of this pure logic file so it stays testable without a translation service. */
export interface ScriptLabels {
  readonly source: Record<ScriptSource, string>;
  readonly effect: Record<ScriptEffect, string>;
  /** The "Example" chip on a sample's row (issue #232). */
  readonly example?: string;
}

/** Builds `ScriptLabels` from Transloco's `translateSignal` output for each enum. `translateSignal`
 * with an array key starts at `['']` (one placeholder, not one per key) until the scope has loaded,
 * so every index past 0 reads as `undefined` on a cold load — falling back to `''` keeps the list
 * subtitle blank instead of rendering the literal text "undefined" (review finding on #51's PR). */
export function labelsFrom(
  sources: readonly ScriptSource[],
  sourceLabels: readonly (string | undefined)[],
  effects: readonly ScriptEffect[],
  effectLabels: readonly (string | undefined)[],
  exampleLabel?: string,
): ScriptLabels {
  return {
    ...(exampleLabel === undefined ? {} : { example: exampleLabel }),
    source: Object.fromEntries(
      sources.map((source, index) => [source, sourceLabels[index] ?? '']),
    ) as Record<ScriptSource, string>,
    effect: Object.fromEntries(
      effects.map((effect, index) => [effect, effectLabels[index] ?? '']),
    ) as Record<ScriptEffect, string>,
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

/** Maps a script to the row `ExerciseList` renders (issue #225): the pattern the user wrote as the
 * title (its first line; the list clamps it at two lines), with its source and effect as chips
 * under it. The title falls back to the new script, else the situation: a draft is saved from any
 * of them (issue #217). With all three blank it is `''`, which `ExerciseList` shows as
 * "Untitled". A sample (issue #232) leads with an "Example" chip and never shows the done check:
 * it counts toward nothing. */
export function toListItem(script: Script, labels: ScriptLabels): ExerciseListItem {
  const chips: ExerciseListChip[] = [
    { label: labels.source[script.source] },
    { label: labels.effect[script.effect] },
  ];
  return {
    id: script.id,
    title:
      [script.text, script.newScript, script.situation]
        .map(firstLine)
        .find((text) => text !== '') ?? '',
    chips: script.sample ? [{ label: labels.example ?? '' }, ...chips] : chips,
    done: !script.sample && isItemComplete(script),
  };
}

/** Draft before record (issue #217): a new script's draft becomes a record once any free-text
 * field (the script, the new script, the situation) holds non-blank text. Choosing a source,
 * effect or decision alone keeps it a draft. */
export function isDraftWorthSaving(
  draft: Pick<ScriptFields, 'text' | 'newScript' | 'situation'>,
): boolean {
  return [draft.text, draft.newScript, draft.situation].some((text) => (text ?? '').trim() !== '');
}

/** Replaces the fields of the live script `id` with `fields`, leaving every other script alone;
 * a no-op copy if `id` is not found or already tombstoned. Any edit makes a sample the user's own
 * (issue #232): its `sample` flag is removed, whichever field changed. */
export function editScript(
  scripts: readonly Script[],
  id: string,
  fields: Partial<ScriptFields>,
): Script[] {
  return scripts.map((script) => {
    if (script.id !== id || !isLive(script)) {
      return script;
    }
    return withoutSample({ ...script, ...fields });
  });
}

// Built on first use, not at module load: `transition.model.ts` imports this file for its hub
// status, so on that import path the enum arrays are still undefined while this module evaluates.
const isSource = (value: unknown): value is ScriptSource => isOneOf(SCRIPT_SOURCES)(value);
const isEffect = (value: unknown): value is ScriptEffect => isOneOf(SCRIPT_EFFECTS)(value);
const isDecision = (value: unknown): value is ScriptDecision => isOneOf(SCRIPT_DECISIONS)(value);
const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** A guide example's `sample` payload (the scope's `guide.examples[].sample`, issue #232) as the
 * fields of a new script, or `null` when it isn't a complete, valid one — the i18n JSON is an
 * input boundary, so its enum keys are checked, never trusted. The caller adds `sample: true`. */
export function scriptFromExample(value: unknown): ScriptFields | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const example = value as Record<string, unknown>;
  const text = optionalText(example['text']);
  const { source, effect, decision } = example;
  if (text === undefined || !isSource(source) || !isEffect(effect) || !isDecision(decision)) {
    return null;
  }
  const newScript = optionalText(example['newScript']);
  const situation = optionalText(example['situation']);
  return {
    text,
    source,
    effect,
    decision,
    ...(newScript === undefined ? {} : { newScript }),
    ...(situation === undefined ? {} : { situation }),
  };
}

/** Tombstones the script `id` (never removed, architecture issue #1 §6). */
export function removeScript(scripts: readonly Script[], id: string, now: Date): Script[] {
  return scripts.map((script) => (script.id === id ? softDelete(script, now) : script));
}

/** Undoes `removeScript()`: clears the script `id`'s tombstone and bumps `updatedAt` (issue
 * #187's delete-with-undo snackbar). A no-op copy if `id` is not found or was never deleted. */
export function restoreScript(scripts: readonly Script[], id: string, now: Date): Script[] {
  return scripts.map((script) =>
    script.id === id && !isLive(script) ? touch({ ...script, deletedAt: undefined }, now) : script,
  );
}

/** Whether `decision` requires the `newScript`/`situation` fields (drives form validation). */
export function requiresNewScript(decision: ScriptDecision): boolean {
  return decision !== 'keep';
}
