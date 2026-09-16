/** 0-100 for a habit's overview progress ring; 0 when there's nothing to divide (`total` 0), never
 * `NaN`. */
export function progressPercentage(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
