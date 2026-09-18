import { BaseRecord } from './record';

/**
 * Shared structural guards for a model's `validate()` (architecture issue #1 §6: "checks
 * structure, not business rules" — types, required fields, arrays and enum membership only).
 * Extracted from `shared/exercise-kit/exercise-kit.model.ts` (issue #51) so every
 * `<feature>.model.ts` reuses the same checks instead of hand-rolling them per feature.
 */

/** True when `value` has every `BaseRecord` field (`record.ts`) with the right shape. */
export function isBaseRecord(value: unknown): value is BaseRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['createdAt'] === 'string' &&
    typeof candidate['updatedAt'] === 'string' &&
    isOptionalString(candidate['deletedAt'])
  );
}

/** True when `value` is `undefined` or a string — a field that is only ever set once the user has
 * typed something into it (e.g. a record's free-text field). */
export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/** Builds a guard for a field stored as one of a fixed set of string keys (architecture issue #1
 * §6: "never store translated text", a stable key instead). */
export function isOneOf<T extends string>(values: readonly T[]): (value: unknown) => value is T {
  return (value): value is T =>
    typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** Builds a guard for an array whose every element passes `guard`. */
export function isArrayOf<T>(
  guard: (value: unknown) => value is T,
): (value: unknown) => value is T[] {
  return (value): value is T[] => Array.isArray(value) && value.every(guard);
}
