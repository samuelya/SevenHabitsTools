/** The exported file's name: `sevenhabits-<yyyy-mm-dd>.json`, the UTC date `now` falls on.
 * There is no per-user name in the document yet to slot in (`profile` is still empty) — this is
 * the whole filename for now, and only this function needs to change once one exists. */
export function buildExportFilename(now: Date): string {
  return `sevenhabits-${now.toISOString().slice(0, 10)}.json`;
}
