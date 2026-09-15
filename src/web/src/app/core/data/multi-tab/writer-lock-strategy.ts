import { WriterLockStatus } from './writer-lock';

/** One way of acquiring the single cross-tab write lock. `WebLocksWriterLock` (the Web Locks API)
 * and `HeartbeatWriterLock` (the `localStorage` fallback) both implement this so `WriterLockService`
 * can use either interchangeably (Liskov substitution), chosen once by feature detection. */
export interface WriterLockStrategy extends WriterLockStatus {
  /** Starts trying to acquire the lock. Call once. */
  start(): void;
  /** Stops trying to acquire or hold the lock and releases any resources (timers, pending
   * requests) it started. */
  stop(): void;
}
