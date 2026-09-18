import { newRecord, softDelete, isLive } from '../../core/data/record';
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

/** Whether `DoneToggle` should be enabled: at least one live script is complete (issue #51's
 * "Implementation notes"). */
export function canMarkDone(scripts: readonly Script[]): boolean {
  return liveScripts(scripts).some(isItemComplete);
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

/** Appends a new script created from `fields`, stamped with a fresh id and `now`. */
export function addScript(scripts: readonly Script[], fields: ScriptFields, now: Date): Script[] {
  return [...scripts, newRecord(fields, now)];
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

/** Whether `decision` requires the `newScript`/`situation` fields (drives form validation). */
export function requiresNewScript(decision: ScriptDecision): boolean {
  return decision !== 'keep';
}
