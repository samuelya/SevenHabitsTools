import { TestBed } from '@angular/core/testing';
import { CLOCK } from './clock';

describe('CLOCK', () => {
  it('the default system clock returns the current time', () => {
    const before = Date.now();
    const clock = TestBed.inject(CLOCK);
    const now = clock.now();
    const after = Date.now();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it('can be swapped for a fixed clock in tests', () => {
    const fixed = new Date('2026-01-01T00:00:00.000Z');
    TestBed.configureTestingModule({
      providers: [{ provide: CLOCK, useValue: { now: () => fixed } }],
    });

    expect(TestBed.inject(CLOCK).now()).toBe(fixed);
  });
});
