import documentV2Fixture from '../../testing/fixtures/document-v2.json';
import { CURRENT_SCHEMA_VERSION, RootDocument } from './document.model';

describe('document.model', () => {
  it('matches the current schema version to the latest fixture', () => {
    const fixture = documentV2Fixture as unknown as RootDocument;
    expect(fixture.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });
});
