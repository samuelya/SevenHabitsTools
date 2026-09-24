/** Identifiers of the habit hubs; they match the `habits.<habit>` keys of the JSON document. */
export const HABIT_IDS = [
  'paradigms',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'h7',
  'interdependence',
] as const;

export type HabitId = (typeof HABIT_IDS)[number];

export interface HabitDefinition {
  readonly id: HabitId;
  /** The long title (`habits` scope): the hub page's `h1` only. */
  readonly titleKey: string;
  /** The ≤ 3-word title (`habits` scope) for chrome such as the habits list (issue #218). */
  readonly shortTitleKey: string;
  readonly icon: string;
}

function habit(id: HabitId, icon: string): HabitDefinition {
  return { id, titleKey: `habits.${id}.title`, shortTitleKey: `habits.${id}.shortTitle`, icon };
}

export const HABITS: readonly HabitDefinition[] = [
  habit('paradigms', 'visibility'),
  habit('h1', 'bolt'),
  habit('h2', 'flag'),
  habit('h3', 'event_available'),
  habit('h4', 'handshake'),
  habit('h5', 'hearing'),
  habit('h6', 'diversity_3'),
  habit('h7', 'self_improvement'),
  habit('interdependence', 'account_balance'),
];

export function isHabitId(value: unknown): value is HabitId {
  return typeof value === 'string' && (HABIT_IDS as readonly string[]).includes(value);
}

export function findHabit(id: unknown): HabitDefinition | undefined {
  return HABITS.find((habit) => habit.id === id);
}
