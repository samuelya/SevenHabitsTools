import { toByteSize, usageMessageFor } from './storage-estimate.utils';

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

describe('usageMessageFor', () => {
  const locale = 'en-u-nu-latn';

  it('collapses 25 B to the "under 1 KB" message, not a raw byte count', () => {
    expect(usageMessageFor(25, locale)).toEqual({ key: 'settings.storage.usageUnderOneKb' });
  });

  it('collapses 900 B to the "under 1 KB" message', () => {
    expect(usageMessageFor(900, locale)).toEqual({ key: 'settings.storage.usageUnderOneKb' });
  });

  it('formats 72 KB with the approx message', () => {
    expect(usageMessageFor(72 * 1024, locale)).toEqual({
      key: 'settings.storage.usageApprox',
      params: { value: '72.0', unit: 'KB' },
    });
  });

  it('formats 1.2 MB with the approx message', () => {
    expect(usageMessageFor(1.2 * 1024 * 1024, locale)).toEqual({
      key: 'settings.storage.usageApprox',
      params: { value: '1.2', unit: 'MB' },
    });
  });

  it('formats 2.5 GB with the approx message', () => {
    expect(usageMessageFor(2.5 * 1024 * 1024 * 1024, locale)).toEqual({
      key: 'settings.storage.usageApprox',
      params: { value: '2.5', unit: 'GB' },
    });
  });
});
