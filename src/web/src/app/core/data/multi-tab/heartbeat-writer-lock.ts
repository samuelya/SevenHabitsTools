import { LocalStorageLike } from '../../browser/local-storage';
import { WriterLockStrategy } from './writer-lock-strategy';
import { WriterRoleState } from './writer-role-state';

export const HEARTBEAT_STORAGE_KEY = 'sevenhabits-writer-heartbeat';
/** How often the writer refreshes its heartbeat, and how often a reader checks for a stale one. */
export const HEARTBEAT_INTERVAL_MS = 2000;
/** A heartbeat older than this is treated as abandoned (its tab closed or crashed). Comfortably
 * more than one `HEARTBEAT_INTERVAL_MS`, so a single delayed tick doesn't look abandoned. */
export const HEARTBEAT_STALE_MS = 5000;
/** After writing a claim, wait this long and read back before trusting it — narrows, without
 * eliminating, the window where two tabs claim at the same instant. */
export const CLAIM_CONFIRM_DELAY_MS = 100;

interface Heartbeat {
  readonly tabId: string;
  readonly at: number;
}

/** The slice of `Window` this class needs to clear its heartbeat as the tab unloads. */
export interface WindowEvents {
  addEventListener(type: 'pagehide', listener: () => void): void;
  removeEventListener(type: 'pagehide', listener: () => void): void;
}

/**
 * Fallback writer lock for browsers without the Web Locks API: a `localStorage` heartbeat naming
 * the writer's unique `tabId`.
 *
 * - **Claiming.** A tab may claim when there is no heartbeat, or it is older than
 *   `HEARTBEAT_STALE_MS`: it checks and writes its own heartbeat in one synchronous step (the
 *   closest `localStorage` has to compare-and-set), then reads back after `CLAIM_CONFIRM_DELAY_MS`
 *   and is the writer only if the entry still names it. A fresh heartbeat from another tab makes
 *   this tab a confirmed reader, which keeps polling every `HEARTBEAT_INTERVAL_MS`.
 * - **Writing.** The writer renews its heartbeat every interval, but steps down instead of
 *   overwriting if the entry names another tab (a claim race it lost, or its timers were
 *   throttled past the stale threshold).
 * - **Handing over.** `pagehide` and `stop()` remove the entry if it is still this tab's, so a
 *   reloading or closing tab never leaves a fresh-looking heartbeat that its own next page load
 *   (with a new `tabId`) would wait out as if it were another tab's (#126).
 *
 * Whether a grant is a promotion is `WriterRoleState`'s decision, shared with `WebLocksWriterLock`.
 */
export class HeartbeatWriterLock implements WriterLockStrategy {
  private readonly state = new WriterRoleState();
  readonly role = this.state.role;
  readonly isWriter = this.state.isWriter;
  readonly promoted = this.state.promoted;

  private timer: ReturnType<typeof setInterval> | undefined;
  private claiming = false;
  private stopped = false;

  constructor(
    private readonly storage: LocalStorageLike,
    private readonly windowEvents: WindowEvents,
    private readonly tabId: string = crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  start(): void {
    this.windowEvents.addEventListener('pagehide', this.handlePageHide);
    this.tick();
    this.timer = setInterval(() => this.tick(), HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    this.timer = undefined;
    this.windowEvents.removeEventListener('pagehide', this.handlePageHide);
    this.releaseIfOwn();
    this.state.reset();
  }

  private readonly handlePageHide = (): void => {
    this.releaseIfOwn();
  };

  private tick(): void {
    if (this.claiming) {
      return;
    }
    const current = this.readHeartbeat();
    if (this.isWriter()) {
      if (current !== null && current.tabId !== this.tabId) {
        this.state.deny();
        return;
      }
      this.writeHeartbeat();
      return;
    }
    if (this.isClaimable(current)) {
      void this.claim();
    } else {
      this.state.deny();
    }
  }

  private isClaimable(current: Heartbeat | null): boolean {
    return (
      current === null ||
      current.tabId === this.tabId ||
      this.now() - current.at > HEARTBEAT_STALE_MS
    );
  }

  private async claim(): Promise<void> {
    this.claiming = true;
    this.writeHeartbeat();
    await new Promise((resolve) => setTimeout(resolve, CLAIM_CONFIRM_DELAY_MS));
    this.claiming = false;
    if (this.stopped) {
      return;
    }
    if (this.readHeartbeat()?.tabId === this.tabId) {
      this.state.grant();
    } else {
      this.state.deny();
    }
  }

  /** Removes the stored heartbeat, but only if it's still this tab's — never a takeover. */
  private releaseIfOwn(): void {
    if (this.readHeartbeat()?.tabId === this.tabId) {
      this.storage.removeItem(HEARTBEAT_STORAGE_KEY);
    }
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
