import { InjectionToken } from '@angular/core';

/** Creates a `BroadcastChannel` for `name`, or `null` in environments without it. A factory
 * (rather than a singleton instance) because each caller opens its own named channel; kept
 * separate from `WINDOW` since `BroadcastChannel` is a global constructor, not a `window`
 * property. */
export type BroadcastChannelFactory = (name: string) => BroadcastChannel | null;

export const BROADCAST_CHANNEL_FACTORY = new InjectionToken<BroadcastChannelFactory>(
  'BROADCAST_CHANNEL_FACTORY',
  {
    providedIn: 'root',
    factory:
      () =>
      (name: string): BroadcastChannel | null =>
        typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name),
  },
);
