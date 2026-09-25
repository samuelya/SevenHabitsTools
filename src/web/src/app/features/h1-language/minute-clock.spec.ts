import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLOCK } from '../../core/time/clock';
import { MINUTE_MS, minuteClock } from './minute-clock';

describe('minuteClock', () => {
  let now: Date;

  beforeEach(() => {
    vi.useFakeTimers();
    now = new Date(2026, 2, 10, 9, 0, 0);
    TestBed.configureTestingModule({
      providers: [{ provide: CLOCK, useValue: { now: () => now } }],
    });
  });
  afterEach(() => vi.useRealTimers());

  function create() {
    return runInInjectionContext(TestBed.inject(Injector), () => minuteClock());
  }

  it('re-reads the clock once a minute, not in between', () => {
    const clock = create();
    now = new Date(2026, 2, 10, 9, 0, 30);
    vi.advanceTimersByTime(MINUTE_MS - 1);
    expect(clock.now()).toEqual(new Date(2026, 2, 10, 9, 0, 0));
    vi.advanceTimersByTime(1);
    expect(clock.now()).toEqual(new Date(2026, 2, 10, 9, 0, 30));
  });

  it('re-reads the clock when the tab becomes visible, and on refresh()', () => {
    const clock = create();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    now = new Date(2026, 2, 11, 10, 0, 0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clock.now()).toEqual(now);
    visibility.mockRestore();

    now = new Date(2026, 2, 11, 10, 0, 5);
    clock.refresh();
    expect(clock.now()).toEqual(now);
  });

  it('ignores the tab being hidden', () => {
    const clock = create();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    now = new Date(2026, 2, 11, 10, 0, 0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clock.now()).toEqual(new Date(2026, 2, 10, 9, 0, 0));
    visibility.mockRestore();
  });
});
