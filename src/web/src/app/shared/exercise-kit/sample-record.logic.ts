import { BaseRecord, isLive } from '../../core/data/record';

/** A list record that may be a copy of a guide example ("Try this example", issue #232). */
export interface SampleableRecord extends BaseRecord {
  readonly sample?: boolean;
}

/** Whether `record` counts toward progress, summaries, "started" and the done gate: live, and not
 * an untouched guide example — a sample counts toward nothing until the user edits it. */
export function isCounted(record: SampleableRecord): boolean {
  return isLive(record) && !record.sample;
}

/** `record` without its `sample` flag: the first edit of any field makes an example the user's own.
 * The same object when there is no flag to remove. */
export function withoutSample<T extends SampleableRecord>(record: T): T {
  if (!('sample' in record)) {
    return record;
  }
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'sample')) as T;
}
