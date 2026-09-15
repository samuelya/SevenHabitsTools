import { Signal, computed, signal } from '@angular/core';

/**
 * This tab's relationship to the cross-tab write lock:
 * - `pending`: the lock request hasn't settled yet (every tab starts here);
 * - `reader`: confirmed that another tab holds the lock;
 * - `writer`: this tab holds the lock.
 */
export type WriterRole = 'pending' | 'reader' | 'writer';

/**
 * The role transitions every `WriterLockStrategy` shares, kept in one place so the Web Locks and
 * heartbeat strategies can't disagree about what a promotion is (#125, #126). A strategy only
 * reports what its lock mechanism observed (`grant()`, `deny()`, `reset()`); this class decides
 * what that means. `pending → writer` is an initial grant, however long it took, and is never a
 * promotion. Only `reader → writer` sets `promoted`, and it stays set: a consumer reacting to it
 * can't miss the transition even if the role changes again before it runs.
 */
export class WriterRoleState {
  private readonly roleSignal = signal<WriterRole>('pending');
  private readonly promotedSignal = signal(false);

  readonly role: Signal<WriterRole> = this.roleSignal.asReadonly();
  readonly isWriter: Signal<boolean> = computed(() => this.roleSignal() === 'writer');
  readonly promoted: Signal<boolean> = this.promotedSignal.asReadonly();

  /** The lock was acquired. */
  grant(): void {
    if (this.roleSignal() === 'reader') {
      this.promotedSignal.set(true);
    }
    this.roleSignal.set('writer');
  }

  /** Another tab holds the lock: confirmed at startup, or this tab lost it. */
  deny(): void {
    this.roleSignal.set('reader');
  }

  /** This tab stopped taking part in the lock (`stop()`); it is no longer the writer. */
  reset(): void {
    this.roleSignal.set('pending');
  }
}
