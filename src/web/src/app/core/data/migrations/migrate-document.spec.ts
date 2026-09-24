import documentV1Fixture from '../../../testing/fixtures/document-v1.json';
import documentV2Fixture from '../../../testing/fixtures/document-v2.json';
import documentV3Fixture from '../../../testing/fixtures/document-v3.json';
import documentV4Fixture from '../../../testing/fixtures/document-v4.json';
import { CURRENT_SCHEMA_VERSION } from '../document.model';
import { Migration } from './migration';
import { migrateDocument, SchemaVersionTooNewError } from './migrate-document';
import { MIGRATION_V1_TO_V2 } from './migration-v1-to-v2';
import { MIGRATION_V2_TO_V3 } from './migration-v2-to-v3';
import { MIGRATION_V3_TO_V4 } from './migration-v3-to-v4';

describe('migrateDocument', () => {
  it('runs every fixture up to the current schema version', () => {
    for (const fixture of [
      documentV1Fixture,
      documentV2Fixture,
      documentV3Fixture,
      documentV4Fixture,
    ]) {
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

    const migrated = MIGRATION_V1_TO_V2.migrate(structuredClone(v1));

    expect(migrated).toEqual({ ...v1, schemaVersion: 2 });
  });

  it('v2 → v3 (#223) only stamps the version: a built-in P/PC asset keeps its key and blank name', () => {
    const v2 = structuredClone(documentV2Fixture) as Record<string, unknown>;
    (v2['habits'] as Record<string, Record<string, unknown>>)['paradigms']['pcAudits'] =
      structuredClone(documentV3Fixture.habits.paradigms.pcAudits);

    expect(MIGRATION_V2_TO_V3.migrate(structuredClone(v2))).toEqual({ ...v2, schemaVersion: 3 });
    expect(migrateDocument(structuredClone(v2))).toEqual({
      ...documentV3Fixture,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
  });

  it('v3 → v4 (#232) only stamps the version: sample scripts and teach entries keep their flag', () => {
    const v3 = structuredClone(documentV3Fixture) as Record<string, unknown>;
    const paradigms = (v3['habits'] as Record<string, Record<string, unknown>>)['paradigms'];
    paradigms['scripts'] = structuredClone(documentV4Fixture.habits.paradigms.scripts);
    paradigms['teach'] = structuredClone(documentV4Fixture.habits.paradigms.teach);

    expect(MIGRATION_V3_TO_V4.migrate(structuredClone(v3))).toEqual({ ...v3, schemaVersion: 4 });
    expect(migrateDocument(structuredClone(v3))).toEqual({
      ...documentV4Fixture,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
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
      {
        from: 2,
        to: 3,
        migrate: (doc) => ({ ...doc, schemaVersion: 3, addedByThird: true }),
      },
      {
        from: 3,
        to: 4,
        migrate: (doc) => ({ ...doc, schemaVersion: 4, addedByFourth: true }),
      },
    ];

    const migrated = migrateDocument({}, migrations);

    expect(migrated).toEqual({
      schemaVersion: 4,
      addedByFirst: true,
      addedBySecond: true,
      addedByThird: true,
      addedByFourth: true,
    });
  });

  it('treats a missing schemaVersion as version 0', () => {
    const migrations: Migration[] = [
      { from: 0, to: 1, migrate: (doc) => ({ ...doc, schemaVersion: 1 }) },
      { from: 1, to: 2, migrate: (doc) => ({ ...doc, schemaVersion: 2 }) },
      { from: 2, to: 3, migrate: (doc) => ({ ...doc, schemaVersion: 3 }) },
      { from: 3, to: 4, migrate: (doc) => ({ ...doc, schemaVersion: 4 }) },
    ];
    expect(migrateDocument({}, migrations)).toEqual({ schemaVersion: 4 });
  });

  it('throws when no migration covers the document version', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, [])).toThrowError(
      /No migration registered from schema version 0/,
    );
  });
});
