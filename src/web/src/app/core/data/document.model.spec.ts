import documentV1Fixture from '../../testing/fixtures/document-v1.json';
import { CURRENT_SCHEMA_VERSION, RootDocument } from './document.model';

describe('document.model', () => {
  it('matches the current schema version to the v1 fixture', () => {
    const fixture = documentV1Fixture as unknown as RootDocument;
    expect(fixture.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
});
