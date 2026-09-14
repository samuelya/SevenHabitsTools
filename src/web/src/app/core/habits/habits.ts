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
  readonly titleKey: string;
  readonly icon: string;
}

export const HABITS: readonly HabitDefinition[] = [
  { id: 'paradigms', titleKey: 'habits.paradigms.title', icon: 'visibility' },
  { id: 'h1', titleKey: 'habits.h1.title', icon: 'bolt' },
  { id: 'h2', titleKey: 'habits.h2.title', icon: 'flag' },
  { id: 'h3', titleKey: 'habits.h3.title', icon: 'event_available' },
  { id: 'h4', titleKey: 'habits.h4.title', icon: 'handshake' },
  { id: 'h5', titleKey: 'habits.h5.title', icon: 'hearing' },
  { id: 'h6', titleKey: 'habits.h6.title', icon: 'diversity_3' },
  { id: 'h7', titleKey: 'habits.h7.title', icon: 'self_improvement' },
  { id: 'interdependence', titleKey: 'habits.interdependence.title', icon: 'account_balance' },
];

export function isHabitId(value: unknown): value is HabitId {
  return typeof value === 'string' && (HABIT_IDS as readonly string[]).includes(value);
}

export function findHabit(id: unknown): HabitDefinition | undefined {
  return HABITS.find((habit) => habit.id === id);
}
