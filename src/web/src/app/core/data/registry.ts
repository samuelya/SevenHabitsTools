import { CURRENT_SCHEMA_VERSION, RootDocument } from './document.model';

/**
 * A feature's slice of the document. `path` is the dot path where the slice lives in
 * `RootDocument` (e.g. `habits.h2.mission`, `shared.roles`, `extras.journal`). Every
 * `<feature>.model.ts` calls `registerModel()` once at module load; nobody edits
 * `document.model.ts` directly, which is what lets parallel feature PRs merge cleanly.
 */
export interface ModelRegistration<T = unknown> {
  readonly key: string;
  readonly path: string;
  readonly defaults: () => T;
  readonly validate?: (value: unknown) => boolean;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

const registrations = new Map<string, ModelRegistration>();

/** Registers a feature's model. Throws if `key` or `path` was already registered. */
export function registerModel<T>(registration: ModelRegistration<T>): void {
  if (registrations.has(registration.key)) {
    throw new Error(`Model "${registration.key}" is already registered`);
  }
  for (const existing of registrations.values()) {
    if (existing.path === registration.path) {
      throw new Error(`Path "${registration.path}" is already registered by "${existing.key}"`);
    }
  }
  registrations.set(registration.key, registration as ModelRegistration);
}

/** The registered models, in registration order. */
export function getRegisteredModels(): readonly ModelRegistration[] {
  return [...registrations.values()];
}

/** Test-only: clears the registry so specs can register fixtures without colliding. */
export function resetRegistryForTesting(): void {
  registrations.clear();
}

/** Builds a fresh document at the current schema version, composed from every registered model's defaults. */
export function createEmptyDocument(): RootDocument {
  const now = new Date().toISOString();
  const doc: Record<string, unknown> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      createdAt: now,
      updatedAt: now,
      appVersion: '0.0.0',
      deviceId: crypto.randomUUID(),
    },
    profile: {},
    settings: {},
    shared: {},
    habits: {},
    extras: {},
  };
  for (const registration of registrations.values()) {
    setPath(doc, registration.path, registration.defaults());
  }
  return doc as unknown as RootDocument;
}

/**
 * Lightweight validation for imported documents: checks each registered model's slice against
 * its own `validate()`, if it declares one. Never strips unknown keys — callers keep the whole
 * parsed document, issues are reported, not auto-corrected.
 */
export function validateDocument(doc: Record<string, unknown>): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const registration of registrations.values()) {
    const value = getPath(doc, registration.path);
    if (value !== undefined && registration.validate && !registration.validate(value)) {
      issues.push({ path: registration.path, message: 'data.validation.invalidModel' });
    }
  }
  return issues;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let node = target;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (!isPlainObject(next)) {
      node[segment] = {};
    }
    node = node[segment] as Record<string, unknown>;
  }
  node[segments[segments.length - 1]] = value;
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, segment) => (isPlainObject(node) ? node[segment] : undefined), source);
}
