import { isArrayOf, isBaseRecord, isOneOf, isOptionalString } from './record-validators';

describe('isBaseRecord', () => {
  it('accepts a value with every base record field', () => {
    expect(isBaseRecord({ id: 'a', createdAt: 'c', updatedAt: 'u' })).toBe(true);
  });

  it('accepts a tombstoned record', () => {
    expect(isBaseRecord({ id: 'a', createdAt: 'c', updatedAt: 'u', deletedAt: 'd' })).toBe(true);
  });

  it('rejects a value missing a required field', () => {
    expect(isBaseRecord({ id: 'a', createdAt: 'c' })).toBe(false);
  });

  it('rejects a value whose deletedAt is not a string', () => {
    expect(isBaseRecord({ id: 'a', createdAt: 'c', updatedAt: 'u', deletedAt: 1 })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isBaseRecord(null)).toBe(false);
    expect(isBaseRecord('x')).toBe(false);
  });
});

describe('isOptionalString', () => {
  it('accepts undefined and strings', () => {
    expect(isOptionalString(undefined)).toBe(true);
    expect(isOptionalString('x')).toBe(true);
  });

  it('rejects other types', () => {
    expect(isOptionalString(1)).toBe(false);
    expect(isOptionalString(null)).toBe(false);
  });
});

describe('isOneOf', () => {
  const isColor = isOneOf(['red', 'green'] as const);

  it('accepts a listed value', () => {
    expect(isColor('red')).toBe(true);
  });

  it('rejects an unlisted value', () => {
    expect(isColor('blue')).toBe(false);
    expect(isColor(1)).toBe(false);
  });
});

describe('isArrayOf', () => {
  const isStringArray = isArrayOf((value): value is string => typeof value === 'string');

  it('accepts an array whose every element passes the guard', () => {
    expect(isStringArray(['a', 'b'])).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(isStringArray([])).toBe(true);
  });

  it('rejects an array with a failing element', () => {
    expect(isStringArray(['a', 1])).toBe(false);
  });

  it('rejects a non-array', () => {
    expect(isStringArray('a')).toBe(false);
  });
});
