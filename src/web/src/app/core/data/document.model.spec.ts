import documentV4Fixture from '../../testing/fixtures/document-v4.json';
import { CURRENT_SCHEMA_VERSION, RootDocument } from './document.model';

describe('document.model', () => {
  it('matches the current schema version to the latest fixture', () => {
    const fixture = documentV4Fixture as unknown as RootDocument;
    expect(fixture.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
  });
});
