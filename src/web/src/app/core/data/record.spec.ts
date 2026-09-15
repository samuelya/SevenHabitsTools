import { isLive, newRecord, softDelete, touch } from './record';

describe('record', () => {
  it('creates a new record with a UUID v4 id and matching timestamps', () => {
    const record = newRecord({ title: 'Circle of influence' });

    expect(record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(record.createdAt).toBe(record.updatedAt);
    expect(record.title).toBe('Circle of influence');
    expect(record.deletedAt).toBeUndefined();
  });

  it('gives every record a distinct id', () => {
    const a = newRecord({});
    const b = newRecord({});
    expect(a.id).not.toBe(b.id);
  });

  it('touch refreshes updatedAt without mutating the original', () => {
    const original = newRecord({});
    const touched = touch(original);

    expect(touched).not.toBe(original);
    expect(touched.id).toBe(original.id);
    expect(touched.createdAt).toBe(original.createdAt);
    expect(new Date(touched.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(original.updatedAt).getTime(),
    );
  });

  it('softDelete tombstones instead of removing the record', () => {
    const original = newRecord({});
    const deleted = softDelete(original);

    expect(deleted).not.toBe(original);
    expect(deleted.id).toBe(original.id);
    expect(deleted.deletedAt).toBeDefined();
    expect(isLive(original)).toBe(true);
    expect(isLive(deleted)).toBe(false);
  });
});
