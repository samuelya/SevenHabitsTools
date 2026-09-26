import { newRecord, touch } from '../../core/data/record';
import type { ExerciseHubStatus } from '../exercise-kit/exercise-registry';
import {
  Mission,
  MissionFields,
  MissionLineList,
  MissionVersion,
  ReviewKey,
} from './mission.model';

/** Every string list on the record: the chips of steps 1–2 and the lines of step 4. */
export type MissionListKey = 'values' | 'principles' | MissionLineList;

/** Step 4 keeps each list short (issue #61): "Ten is plenty". */
export const MAX_LINES = 10;

/** The cap per list; the chip lists have none. */
export function maxFor(list: MissionListKey): number {
  return list === 'toBe' || list === 'toDo' ? MAX_LINES : Infinity;
}

/** The one normalisation every reader of a typed line uses: trimmed, inner whitespace collapsed. */
export function normaliseLine(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Two lines are the same when their normalised text matches case-insensitively. */
export function sameLine(a: string, b: string): boolean {
  return normaliseLine(a).toLocaleLowerCase() === normaliseLine(b).toLocaleLowerCase();
}

export function hasLine(list: readonly string[], text: string): boolean {
  return list.some((line) => sameLine(line, text));
}

/** What adding a line did: `added`, or why the list is unchanged. The caller keeps the typed text
 * unless the line is now in the list (`added`, `duplicate`). */
export type AddOutcome = 'added' | 'duplicate' | 'empty' | 'full' | 'refused';

/** `list` with `text` appended (normalised), or the reason it isn't. */
export function withLine(
  list: readonly string[],
  text: string,
  max: number,
): { readonly list: readonly string[]; readonly outcome: Exclude<AddOutcome, 'refused'> } {
  const line = normaliseLine(text);
  if (line === '') {
    return { list, outcome: 'empty' };
  }
  if (hasLine(list, line)) {
    return { list, outcome: 'duplicate' };
  }
  if (list.length >= max) {
    return { list, outcome: 'full' };
  }
  return { list: [...list, line], outcome: 'added' };
}

/** `list` without the line at `index`; the same list when there is none. */
export function withoutLine(list: readonly string[], index: number): readonly string[] {
  return index >= 0 && index < list.length ? list.filter((_, i) => i !== index) : list;
}

export function blankMissionFields(): MissionFields {
  return {
    values: [],
    principles: [],
    roleLines: [],
    toBe: [],
    toDo: [],
    draft: '',
    checklist: {},
    versions: [],
  };
}

/** Whether an edit carries anything the user wrote or chose: the record is created on the first
 * one (a chip added, a line typed), never on an empty keystroke or an unchecked box. */
export function isDraftWorthSaving(fields: Partial<MissionFields>): boolean {
  return Object.values(fields).some((value) => {
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some((answer) => answer === true);
    }
    return false;
  });
}

/**
 * `mission` with `fields` applied. A no-op edit (every field already equal) returns `mission`
 * itself, and so does an edit that isn't worth creating the record for, while it doesn't exist.
 */
export function editMission(
  mission: Mission | null,
  fields: Partial<MissionFields>,
  now: Date,
): Mission | null {
  if (mission === null) {
    return isDraftWorthSaving(fields)
      ? newRecord({ ...blankMissionFields(), ...fields }, now)
      : null;
  }
  const changed = (Object.keys(fields) as (keyof MissionFields)[]).some(
    (key) => !Object.is(fields[key], mission[key]),
  );
  return changed ? touch({ ...mission, ...fields }, now) : mission;
}

/** `mission` with `roleId`'s line set; an emptied line is dropped. Unchanged → same reference. */
export function roleLinesWith(
  lines: Mission['roleLines'],
  roleId: string,
  text: string,
): Mission['roleLines'] {
  const existing = lines.find((line) => line.roleId === roleId);
  if (text.trim() === '') {
    return existing ? lines.filter((line) => line.roleId !== roleId) : lines;
  }
  if (!existing) {
    return [...lines, { roleId, text }];
  }
  return existing.text === text
    ? lines
    : lines.map((line) => (line.roleId === roleId ? { roleId, text } : line));
}

/** `checklist` with `key` answered; the same object when the answer is unchanged. */
export function checklistWith(
  checklist: Mission['checklist'],
  key: ReviewKey,
  value: boolean,
): Mission['checklist'] {
  return checklist[key] === value ? checklist : { ...checklist, [key]: value };
}

/** Words in `text`: whitespace-separated tokens, which holds for Arabic without a locale rule. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => token !== '').length;
}

/** `draft` with `text` added as a new paragraph at its end ("Use this"); unchanged when `text` is
 * blank. */
export function appendParagraph(draft: string, text: string): string {
  const paragraph = text.trim();
  if (paragraph === '') {
    return draft;
  }
  const body = draft.trimEnd();
  return body === '' ? paragraph : `${body}\n\n${paragraph}`;
}

function latestVersion(mission: Mission | null): MissionVersion | null {
  return mission?.versions.at(-1) ?? null;
}

/** The statement other tools read (#71, #97): the latest saved version's text, or `''`. */
export function currentStatement(mission: Mission | null): string {
  return latestVersion(mission)?.text ?? '';
}

/** "Save version" is enabled when the draft has words and differs from the latest version. */
export function canSaveVersion(mission: Mission | null): boolean {
  if (mission === null || mission.draft.trim() === '') {
    return false;
  }
  return mission.draft.trim() !== currentStatement(mission);
}

/** `mission` with the draft appended as a new version; the same reference when it can't be. */
export function withVersion(mission: Mission, id: string, now: Date, note?: string): Mission {
  if (!canSaveVersion(mission)) {
    return mission;
  }
  const version: MissionVersion = {
    id,
    savedAt: now.toISOString(),
    text: mission.draft.trim(),
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
  return touch({ ...mission, versions: [...mission.versions, version] }, now);
}

/** The four gate items (issue #61), in step order. */
export const CHECKLIST_KEYS = ['valueOrPrinciple', 'roleLine', 'draft', 'version'] as const;
export type MissionChecklistKey = (typeof CHECKLIST_KEYS)[number];

type ChecklistMet = Readonly<Record<MissionChecklistKey, boolean>>;

/** The one source of "met" for the stepper ticks, the gate list and the gate button. */
export function checklistMet(mission: Mission | null): ChecklistMet {
  return {
    valueOrPrinciple: (mission?.values.length ?? 0) + (mission?.principles.length ?? 0) > 0,
    roleLine: mission?.roleLines.some((line) => line.text.trim() !== '') ?? false,
    draft: wordCount(mission?.draft ?? '') > 0,
    version: (mission?.versions.length ?? 0) > 0,
  };
}

/** "Mark done" needs a saved version (lead decision Q5 on #8), which implies a draft. */
export function isComplete(mission: Mission | null): boolean {
  return checklistMet(mission).version;
}

/** Each step's tick in the stepper header, in step order (values … review). */
export function stepsDone(mission: Mission | null): readonly boolean[] {
  const met = checklistMet(mission);
  return [
    (mission?.values.length ?? 0) > 0,
    (mission?.principles.length ?? 0) > 0,
    met.roleLine,
    (mission?.toBe.length ?? 0) > 0 && (mission?.toDo.length ?? 0) > 0,
    met.draft,
    met.version,
  ];
}

export interface ChecklistItem {
  readonly label: string;
  readonly met: boolean;
}

export function doneChecklist(
  mission: Mission | null,
  labels: Readonly<Record<MissionChecklistKey, string>>,
): readonly ChecklistItem[] {
  const met = checklistMet(mission);
  return CHECKLIST_KEYS.map((key) => ({ label: labels[key], met: met[key] }));
}

/** `translateSignal`'s array output keyed back; `''` per key before the scope loads (playbook §6). */
export function checklistLabelsFrom(
  labels: readonly string[],
): Readonly<Record<MissionChecklistKey, string>> {
  return Object.fromEntries(
    CHECKLIST_KEYS.map((key, index) => [key, labels[index] ?? '']),
  ) as Readonly<Record<MissionChecklistKey, string>>;
}

export function checklistLoaded(labels: Readonly<Record<MissionChecklistKey, string>>): boolean {
  return labels[CHECKLIST_KEYS[0]] !== '';
}

/** A worksheet has started once its record exists (#216). */
export function isStarted(mission: Mission | null): boolean {
  return mission !== null;
}

/** The hub's text: "Version n" once saved, "Draft, n words" while drafting, else `null`. */
export function hubStatus(mission: Mission | null): ExerciseHubStatus | null {
  const versions = mission?.versions.length ?? 0;
  if (versions > 0) {
    return { key: 'habits.exercises.h2-mission.versionCount', count: versions };
  }
  const words = wordCount(mission?.draft ?? '');
  return words > 0 ? { key: 'habits.exercises.h2-mission.draftWords', count: words } : null;
}
