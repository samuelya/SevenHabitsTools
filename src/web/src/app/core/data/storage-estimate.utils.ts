const UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

/** Formats a byte count as a human-readable size (KB/MB/GB/TB), for the Settings storage
 * estimate. Byte counts under 1 KB are shown as whole bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < UNITS.length - 1);
  return `${value.toFixed(1)} ${UNITS[unitIndex]}`;
}
