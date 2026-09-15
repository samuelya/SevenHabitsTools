import { formatBytes } from './storage-estimate.utils';

describe('formatBytes', () => {
  it('shows whole bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes to one decimal place', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });

  it('caps out at terabytes instead of going further', () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024 * 1024 * 1024)).toBe('2048.0 TB');
  });

  it('rounds fractional bytes', () => {
    expect(formatBytes(512.6)).toBe('513 B');
  });
});
