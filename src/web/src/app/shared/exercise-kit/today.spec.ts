import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLOCK } from '../../core/time/clock';
import { msUntilNextLocalDay, todaySignal } from './today';

// Review finding 5 (PR #282).
describe('todaySignal', () => {
  let now: Date;

  beforeEach(() => {
    vi.useFakeTimers();
    now = new Date(2026, 2, 10, 23, 59, 0);
    TestBed.configureTestingModule({
      providers: [{ provide: CLOCK, useValue: { now: () => now } }],
    });
  });
  afterEach(() => vi.useRealTimers());

  function create() {
    return runInInjectionContext(TestBed.inject(Injector), () => todaySignal());
  }

  it('waits until just past the next local midnight', () => {
    expect(msUntilNextLocalDay(new Date(2026, 2, 10, 23, 59, 0))).toBe(61_000);
    expect(msUntilNextLocalDay(new Date(2026, 2, 10, 0, 0, 0, 500))).toBe(86_400_500);
  });

  it('changes to the new date once the clock passes midnight', () => {
    const today = create();
    expect(today()).toBe('2026-03-10');
    now = new Date(2026, 2, 11, 0, 0, 1);
    vi.advanceTimersByTime(61_000);
    expect(today()).toBe('2026-03-11');
    now = new Date(2026, 2, 12, 0, 0, 1);
    vi.advanceTimersByTime(86_400_000);
    expect(today()).toBe('2026-03-12');
  });

  it('re-reads the clock when the tab becomes visible again', () => {
    const today = create();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    now = new Date(2026, 2, 13, 8, 0, 0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(today()).toBe('2026-03-13');
    visibility.mockRestore();
  });
});
