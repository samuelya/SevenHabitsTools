import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { AffirmationPractice, PRACTICE_TICK_MS, PracticeDialogData } from './affirmation-practice';

const START = new Date(2026, 8, 10, 7, 30, 0).getTime();

interface Setup {
  fixture: ComponentFixture<AffirmationPractice>;
  close: ReturnType<typeof vi.fn>;
  /** Moves the fixed clock forward without firing any timer. */
  advanceClock: (ms: number) => void;
}

function setUp(data: Partial<PracticeDialogData> = {}): Setup {
  let now = START;
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: CLOCK, useValue: { now: () => new Date(now) } },
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { text: 'I breathe out.', scene: 'The hallway.', length: 60, ...data },
      },
    ],
  });
  const fixture = TestBed.createComponent(AffirmationPractice);
  fixture.detectChanges();
  return { fixture, close, advanceClock: (ms) => (now += ms) };
}

function el(fixture: ComponentFixture<AffirmationPractice>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function countdown(fixture: ComponentFixture<AffirmationPractice>): string {
  return el(fixture).querySelector('.practice-countdown')?.textContent?.trim() ?? '';
}

function announcement(fixture: ComponentFixture<AffirmationPractice>): string {
  return el(fixture).querySelector('.practice-announcement')?.textContent?.trim() ?? '';
}

function click(fixture: ComponentFixture<AffirmationPractice>, selector: string): void {
  (el(fixture).querySelector(selector) as HTMLElement).click();
  fixture.detectChanges();
}

describe('AffirmationPractice', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
  afterEach(() => vi.useRealTimers());

  it('shows the affirmation large, its scene, the chosen length and Start, with no Done', () => {
    const { fixture } = setUp({ length: 120 });
    expect(el(fixture).querySelector('.practice-text')?.textContent?.trim()).toBe('I breathe out.');
    expect(el(fixture).querySelector('.practice-scene')?.textContent?.trim()).toBe('The hallway.');
    expect(countdown(fixture)).toBe('2:00');
    expect(el(fixture).querySelector('.practice-countdown')?.getAttribute('role')).toBe('timer');
    expect(el(fixture).querySelector('.practice-start')).not.toBeNull();
    expect(el(fixture).querySelector('.practice-done')).toBeNull();
    expect(announcement(fixture)).toBe('');
  });

  it('changes the length before Start', () => {
    const { fixture } = setUp();
    const toggles = el(fixture).querySelectorAll<HTMLButtonElement>('mat-button-toggle button');
    expect([...toggles].map((button) => button.textContent?.trim())).toEqual([
      '30 s',
      '1 min',
      '2 min',
    ]);
    toggles[0].click();
    fixture.detectChanges();
    expect(countdown(fixture)).toBe('0:30');
  });

  it('computes the remaining time from CLOCK on each tick, not from how many ticks ran', () => {
    const { fixture, advanceClock } = setUp();
    click(fixture, '.practice-start');
    expect(countdown(fixture)).toBe('1:00');

    // 18 s pass with no tick at all (a throttled, hidden tab); one tick then shows 0:42.
    advanceClock(18_000);
    fixture.detectChanges();
    expect(countdown(fixture)).toBe('1:00');
    vi.advanceTimersByTime(PRACTICE_TICK_MS);
    fixture.detectChanges();
    expect(countdown(fixture)).toBe('0:42');
  });

  it('re-reads the clock when the tab becomes visible again', () => {
    const { fixture, advanceClock } = setUp();
    click(fixture, '.practice-start');
    advanceClock(20_000);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    expect(countdown(fixture)).toBe('0:40');
    visibility.mockRestore();
  });

  it('a device asleep past the end reads 0:00 at once and logs no more than the length', () => {
    const { fixture, close, advanceClock } = setUp();
    click(fixture, '.practice-start');
    advanceClock(180_000);
    vi.advanceTimersByTime(PRACTICE_TICK_MS);
    fixture.detectChanges();
    expect(countdown(fixture)).toBe('0:00');
    expect(announcement(fixture)).toBe("Time's up. Tap Done when you're ready.");
    // The interval stops at zero.
    expect(vi.getTimerCount()).toBe(0);

    click(fixture, '.practice-done');
    expect(close).toHaveBeenCalledWith({ seconds: 60, length: 60 });
  });

  it('announces halfway once past half the length, and nothing before', () => {
    const { fixture, advanceClock } = setUp();
    click(fixture, '.practice-start');
    advanceClock(29_000);
    vi.advanceTimersByTime(PRACTICE_TICK_MS);
    fixture.detectChanges();
    expect(announcement(fixture)).toBe('');
    advanceClock(1_000);
    vi.advanceTimersByTime(PRACTICE_TICK_MS);
    fixture.detectChanges();
    expect(announcement(fixture)).toBe('Halfway.');
    expect(el(fixture).querySelector('.practice-announcement')?.getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('Done early logs the seconds actually spent and the chosen length', () => {
    const { fixture, close, advanceClock } = setUp({ length: 30 });
    click(fixture, '.practice-start');
    advanceClock(12_400);
    click(fixture, '.practice-done');
    expect(close).toHaveBeenCalledWith({ seconds: 12, length: 30 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closed mid-run (Escape, Close) logs nothing and leaves no interval running', () => {
    const { fixture, close, advanceClock } = setUp();
    click(fixture, '.practice-start');
    advanceClock(5_000);
    vi.advanceTimersByTime(PRACTICE_TICK_MS * 4);
    expect(vi.getTimerCount()).toBe(1);
    // MatDialog destroys the component however it closes; only Done calls `close` with a result.
    fixture.destroy();
    expect(close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('AffirmationPractice focus', () => {
  it('moves focus from Start to Done once Done is rendered', async () => {
    const { fixture } = setUp();
    document.body.appendChild(fixture.nativeElement);
    (el(fixture).querySelector('.practice-start') as HTMLButtonElement).focus();
    click(fixture, '.practice-start');
    await fixture.whenStable();
    expect(document.activeElement).toBe(el(fixture).querySelector('.practice-done'));
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
  });
});
