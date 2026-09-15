/**
 * Pure helpers for reading and immutably writing a dot path (e.g. `habits.h2.mission`) into a
 * plain object tree. Used by `DocumentStore` to update the document without mutating it, so a
 * signal change is a genuinely new value.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the value at `path` out of `source`, or `undefined` if any segment is missing. */
export function getAtPath<T>(source: unknown, path: string): T | undefined {
  const value = path
    .split('.')
    .reduce<unknown>((node, segment) => (isPlainObject(node) ? node[segment] : undefined), source);
  return value as T | undefined;
}

/**
 * Returns a copy of `source` with `value` set at `path`, cloning only the objects along the way
 * (structural sharing) so parts of the document untouched by the write keep their identity.
 */
export function setAtPath<T extends Record<string, unknown>>(
  source: T,
  path: string,
  value: unknown,
): T {
  const [head, ...rest] = path.split('.');
  if (head === undefined || head === '') {
    throw new Error('Path must not be empty');
  }
  const existing = source[head];
  const nextValue =
    rest.length === 0
      ? value
      : setAtPath(isPlainObject(existing) ? existing : {}, rest.join('.'), value);
  return { ...source, [head]: nextValue };
}
