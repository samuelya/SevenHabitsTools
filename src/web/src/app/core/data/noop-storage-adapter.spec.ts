import { describeStorageAdapterContract } from './storage-adapter.contract';
import { NoopAdapter } from './noop-storage-adapter';

describe('NoopAdapter', () => {
  describeStorageAdapterContract(() => new NoopAdapter());

  it('reports its kind as noop', () => {
    expect(new NoopAdapter().kind).toBe('noop');
  });
});
