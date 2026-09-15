import documentV1Fixture from '../../../testing/fixtures/document-v1.json';
import { CURRENT_SCHEMA_VERSION } from '../document.model';
import { Migration } from './migration';
import { migrateDocument, SchemaVersionTooNewError } from './migrate-document';

describe('migrateDocument', () => {
  it('runs every fixture up to the current schema version unchanged', () => {
    const fixture = structuredClone(documentV1Fixture) as Record<string, unknown>;
    const migrated = migrateDocument(fixture);

    expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated).toEqual(documentV1Fixture);
  });

  it('rejects a document from a newer schema version', () => {
    expect(() => migrateDocument({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, [])).toThrow(
      SchemaVersionTooNewError,
    );
  });

  it('walks a chain of migrations in order up to the current version', () => {
    const migrations: Migration[] = [
      {
        from: 0,
        to: 1,
        migrate: (doc) => ({ ...doc, schemaVersion: 1, addedByFirst: true }),
      },
    ];

    const migrated = migrateDocument({}, migrations);

    expect(migrated).toEqual({ schemaVersion: 1, addedByFirst: true });
  });

  it('treats a missing schemaVersion as version 0', () => {
    const migrations: Migration[] = [
      { from: 0, to: 1, migrate: (doc) => ({ ...doc, schemaVersion: 1 }) },
    ];
    expect(migrateDocument({}, migrations)).toEqual({ schemaVersion: 1 });
  });

  it('throws when no migration covers the document version', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, [])).toThrowError(
      /No migration registered from schema version 0/,
    );
  });
});
