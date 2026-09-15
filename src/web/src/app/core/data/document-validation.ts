import { isRootDocumentShape, RootDocument } from './document.model';
import { migrateDocument } from './migrations/migrate-document';
import { validateDocument } from './registry';

export interface DocumentValidationSuccess {
  readonly ok: true;
  readonly document: RootDocument;
}

export interface DocumentValidationFailure {
  readonly ok: false;
  readonly error: unknown;
}

export type DocumentValidationResult = DocumentValidationSuccess | DocumentValidationFailure;

/**
 * Runs `raw` through the one path this app uses to decide whether a document is acceptable:
 * `migrateDocument()` (up to `CURRENT_SCHEMA_VERSION`, or `SchemaVersionTooNewError` for a future
 * one) then `isRootDocumentShape()` plus every registered model's own `validate()`
 * (`registry.ts`). Shared by `document-bootstrap.ts` (on load) and the JSON import path
 * (`document-import-export.service.ts`) so there is exactly one place — not a copy in each — that
 * decides whether a loaded or imported document is safe to use.
 */
export function resolveDocument(raw: unknown): DocumentValidationResult {
  try {
    const migrated = migrateDocument(raw as Record<string, unknown>);
    if (!isRootDocumentShape(migrated) || validateDocument(migrated).length > 0) {
      return { ok: false, error: new Error('Document has an invalid shape') };
    }
    return { ok: true, document: migrated };
  } catch (error) {
    return { ok: false, error };
  }
}
