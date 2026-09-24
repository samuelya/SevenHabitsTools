import type { DoneChecklistItem } from './done-toggle/done-toggle';

/** Which checklist items one candidate (a script, an audit, an entry) meets, keyed by item. */
export type ChecklistMet<K extends string> = Readonly<Record<K, boolean>>;

/** Already-translated checklist labels, keyed the same way `ChecklistMet` is. */
export type ChecklistLabels<K extends string> = Readonly<Record<K, string>>;

/**
 * The "met" map a list or assessment exercise's checklist shows (issue #215): its done rule is
 * "at least one live item passes", so the checklist describes the one item closest to passing —
 * the item meeting the most keys, the earliest on a tie — and every key is unmet with no items.
 * All keys met here exactly when some item meets them all, so an exercise's `isComplete()` and
 * `doneChecklist()` can both reduce this one map and never disagree.
 */
export function closestMet<T, K extends string>(
  items: readonly T[],
  keys: readonly K[],
  metOf: (item: T) => ChecklistMet<K>,
): ChecklistMet<K> {
  let best = Object.fromEntries(keys.map((key) => [key, false])) as ChecklistMet<K>;
  let bestCount = -1;
  for (const item of items) {
    const met = metOf(item);
    const count = keys.filter((key) => met[key]).length;
    if (count > bestCount) {
      best = met;
      bestCount = count;
    }
  }
  return best;
}

export function allMet<K extends string>(keys: readonly K[], met: ChecklistMet<K>): boolean {
  return keys.every((key) => met[key]);
}

/** `DoneToggle`'s checklist rows, in `keys` order. */
export function checklistItems<K extends string>(
  keys: readonly K[],
  met: ChecklistMet<K>,
  labels: ChecklistLabels<K>,
): readonly DoneChecklistItem[] {
  return keys.map((key) => ({ label: labels[key], met: met[key] }));
}

/** `translateSignal`'s array output, back into labels keyed like `keys` — `''` per key before the
 * scope has loaded (playbook §6's second pitfall: an array key starts at `['']`). */
export function checklistLabels<K extends string>(
  keys: readonly K[],
  translated: readonly (string | undefined)[],
): ChecklistLabels<K> {
  return Object.fromEntries(
    keys.map((key, index) => [key, translated[index] ?? '']),
  ) as ChecklistLabels<K>;
}

/** Whether `checklistLabels()`'s output is real text yet, not `translateSignal`'s placeholder —
 * the same load gate `perception.logic.ts`'s `checklistLoaded()` applies. */
export function labelsLoaded<K extends string>(
  keys: readonly K[],
  labels: ChecklistLabels<K>,
): boolean {
  return labels[keys[0]] !== '';
}
