import { softDelete, touch, isLive } from '../../core/data/record';
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
import { ExerciseListItem } from '../../shared/exercise-kit/exercise-list/exercise-list.logic';
import {
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

/** Started once any live script exists (issue #216) — the hub's "started" and the intro card's
 * collapse both read this. */
export function isStarted(scripts: readonly Script[]): boolean {
  return scripts.some(isLive);
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
  return closestMet(liveScripts(scripts), CHECKLIST_KEYS, scriptMet);
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

/** The summary card's counts (issue #51's acceptance criteria): how many live scripts are
 * decided to stop or be rewritten, out of how many live scripts total. */
export interface TransitionSummary {
  readonly stopped: number;
  readonly rewritten: number;
  readonly total: number;
}

export function summarize(scripts: readonly Script[]): TransitionSummary {
  const live = liveScripts(scripts);
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
): ScriptLabels {
  return {
    source: Object.fromEntries(
      sources.map((source, index) => [source, sourceLabels[index] ?? '']),
    ) as Record<ScriptSource, string>,
    effect: Object.fromEntries(
      effects.map((effect, index) => [effect, effectLabels[index] ?? '']),
    ) as Record<ScriptEffect, string>,
  };
}

/** Maps a script to the row `ExerciseList` renders. */
export function toListItem(script: Script, labels: ScriptLabels): ExerciseListItem {
  return {
    id: script.id,
    title: script.text,
    subtitle: `${labels.source[script.source]} · ${labels.effect[script.effect]}`,
    done: isItemComplete(script),
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
 * a no-op copy if `id` is not found or already tombstoned. */
export function editScript(
  scripts: readonly Script[],
  id: string,
  fields: Partial<ScriptFields>,
): Script[] {
  return scripts.map((script) =>
    script.id === id && isLive(script) ? { ...script, ...fields } : script,
  );
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
