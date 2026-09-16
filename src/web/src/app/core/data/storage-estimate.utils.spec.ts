import { toByteSize } from './storage-estimate.utils';

describe('toByteSize', () => {
  it('shows whole bytes under 1 KB', () => {
    expect(toByteSize(512)).toEqual({ value: 512, unit: 'B', fractionDigits: 0 });
  });

  it('formats kilobytes to one decimal place', () => {
    expect(toByteSize(2048)).toEqual({ value: 2, unit: 'KB', fractionDigits: 1 });
  });

  it('formats megabytes', () => {
    expect(toByteSize(5 * 1024 * 1024)).toEqual({ value: 5, unit: 'MB', fractionDigits: 1 });
  });

  it('formats gigabytes', () => {
    expect(toByteSize(3 * 1024 * 1024 * 1024)).toEqual({ value: 3, unit: 'GB', fractionDigits: 1 });
  });

  it('caps out at terabytes instead of going further', () => {
    expect(toByteSize(2 * 1024 * 1024 * 1024 * 1024 * 1024)).toEqual({
      value: 2048,
      unit: 'TB',
      fractionDigits: 1,
    });
  });

  it('rounds fractional bytes', () => {
    expect(toByteSize(512.6)).toEqual({ value: 513, unit: 'B', fractionDigits: 0 });
  });
});
