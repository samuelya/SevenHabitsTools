import { InjectionToken } from '@angular/core';

/** A source of the current time. The only thing that should call `new Date()` for a timestamp
 * that ends up in the document is the `DocumentStore`, and it does so through this seam so tests
 * can fix the clock instead of racing real time. */
export interface Clock {
  now(): Date;
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => new SystemClock(),
});
