import { Signal, signal } from '@angular/core';
import { LocalStorageLike } from '../../browser/local-storage';
import { WriterLockStrategy } from './writer-lock-strategy';

export const HEARTBEAT_STORAGE_KEY = 'sevenhabits-writer-heartbeat';
/** How often the writer refreshes its heartbeat, and how often a reader checks for a stale one. */
export const HEARTBEAT_INTERVAL_MS = 2000;
/** A heartbeat older than this is treated as abandoned (its tab closed or crashed). Comfortably
 * more than one `HEARTBEAT_INTERVAL_MS`, so a single delayed tick doesn't look abandoned. */
export const HEARTBEAT_STALE_MS = 5000;
/** After writing a tentative claim, wait this long and read back before trusting it — narrows,
 * without eliminating, the window where two tabs claim at the same instant. */
const CLAIM_CONFIRM_DELAY_MS = 100;

interface Heartbeat {
  readonly tabId: string;
  readonly at: number;
}

/**
 * Fallback writer lock for browsers without the Web Locks API: a `localStorage` heartbeat.
 * Whichever tab most recently wrote a heartbeat within `HEARTBEAT_STALE_MS` is the writer; every
 * other tab polls every `HEARTBEAT_INTERVAL_MS` and claims the lock once that heartbeat goes
 * stale. `localStorage` has no compare-and-swap, so two tabs claiming at the same instant is
 * possible in principle; the read-back confirmation narrows that window without closing it, which
 * is the best a pure-`localStorage` fallback can do.
 */
export class HeartbeatWriterLock implements WriterLockStrategy {
  private readonly isWriterSignal = signal(false);
  readonly isWriter: Signal<boolean> = this.isWriterSignal.asReadonly();

  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly storage: LocalStorageLike,
    private readonly tabId: string = crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  start(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.isWriterSignal.set(false);
  }

  private tick(): void {
    if (this.isWriterSignal()) {
      this.writeHeartbeat();
      return;
    }
    const current = this.readHeartbeat();
    if (current === null || this.now() - current.at > HEARTBEAT_STALE_MS) {
      void this.tryClaim();
    }
  }

  private async tryClaim(): Promise<void> {
    this.writeHeartbeat();
    await new Promise((resolve) => setTimeout(resolve, CLAIM_CONFIRM_DELAY_MS));
    const current = this.readHeartbeat();
    this.isWriterSignal.set(current?.tabId === this.tabId);
  }

  private writeHeartbeat(): void {
    const heartbeat: Heartbeat = { tabId: this.tabId, at: this.now() };
    this.storage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeat));
  }

  private readHeartbeat(): Heartbeat | null {
    const raw = this.storage.getItem(HEARTBEAT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as Heartbeat;
    } catch {
      return null;
    }
  }
}
