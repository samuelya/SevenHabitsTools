import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { introCollapsedByDefault } from './intro-collapsed';

function setUp(handset: boolean): void {
  const state: BreakpointState = { matches: handset, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => handset },
      },
    ],
  });
}

describe('introCollapsedByDefault (issues #212, #216)', () => {
  it('is expanded on desktop until the exercise is started, then collapsed', () => {
    setUp(false);
    const started = signal(false);
    const collapsed = TestBed.runInInjectionContext(() => introCollapsedByDefault(started));

    expect(collapsed()).toBe(false);
    started.set(true);
    expect(collapsed()).toBe(true);
  });

  it('is always collapsed on a handset, started or not', () => {
    setUp(true);
    const started = signal(false);
    const collapsed = TestBed.runInInjectionContext(() => introCollapsedByDefault(started));

    expect(collapsed()).toBe(true);
    started.set(true);
    expect(collapsed()).toBe(true);
  });
});
