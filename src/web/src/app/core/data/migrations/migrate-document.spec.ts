import documentV1Fixture from '../../../testing/fixtures/document-v1.json';
import documentV2Fixture from '../../../testing/fixtures/document-v2.json';
import { CURRENT_SCHEMA_VERSION } from '../document.model';
import { Migration } from './migration';
import { migrateDocument, SchemaVersionTooNewError } from './migrate-document';

describe('migrateDocument', () => {
  it('runs every fixture up to the current schema version', () => {
    for (const fixture of [documentV1Fixture, documentV2Fixture]) {
      const migrated = migrateDocument(structuredClone(fixture) as Record<string, unknown>);

      expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
      expect(migrated).toEqual({ ...fixture, schemaVersion: CURRENT_SCHEMA_VERSION });
    }
  });

  it('v1 → v2 (#222) only stamps the version: every slice is kept as it was', () => {
    const v1 = {
      ...structuredClone(documentV1Fixture),
      habits: { paradigms: { maturity: [{ id: 'a1', areas: [{ id: 'ar1', key: 'community' }] }] } },
    } as Record<string, unknown>;

    const migrated = migrateDocument(structuredClone(v1));

    expect(migrated).toEqual({ ...v1, schemaVersion: 2 });
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
      {
        from: 1,
        to: 2,
        migrate: (doc) => ({ ...doc, schemaVersion: 2, addedBySecond: true }),
      },
    ];

    const migrated = migrateDocument({}, migrations);

    expect(migrated).toEqual({ schemaVersion: 2, addedByFirst: true, addedBySecond: true });
  });

  it('treats a missing schemaVersion as version 0', () => {
    const migrations: Migration[] = [
      { from: 0, to: 1, migrate: (doc) => ({ ...doc, schemaVersion: 1 }) },
      { from: 1, to: 2, migrate: (doc) => ({ ...doc, schemaVersion: 2 }) },
    ];
    expect(migrateDocument({}, migrations)).toEqual({ schemaVersion: 2 });
  });

  it('throws when no migration covers the document version', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, [])).toThrowError(
      /No migration registered from schema version 0/,
    );
  });
});
