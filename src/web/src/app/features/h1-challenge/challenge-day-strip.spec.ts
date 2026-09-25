import { Directionality } from '@angular/cdk/bidi';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { ChallengeDayStrip } from './challenge-day-strip';
import { dayStates } from './challenge.logic';
import type { Challenge } from './challenge.model';

const TODAY = '2026-03-12';

function test(fields: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
    startDate: '2026-03-01',
    status: 'active',
    checkins: [],
    ...fields,
  };
}

function setUp(dir: 'ltr' | 'rtl' = 'ltr'): ComponentFixture<ChallengeDayStrip> {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), { provide: Directionality, useValue: { value: dir } }],
  });
  const fixture = TestBed.createComponent(ChallengeDayStrip);
  fixture.componentRef.setInput('cells', dayStates(test(), TODAY));
  fixture.componentRef.setInput('anchorDate', TODAY);
  fixture.detectChanges();
  document.body.appendChild(fixture.nativeElement);
  return fixture;
}

function cells(fixture: ComponentFixture<ChallengeDayStrip>): HTMLButtonElement[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.cell')];
}

function tabStops(fixture: ComponentFixture<ChallengeDayStrip>): number[] {
  return cells(fixture)
    .map((cell, index) => (cell.getAttribute('tabindex') === '0' ? index + 1 : null))
    .filter((day) => day !== null);
}

/** CDK's `ListKeyManager` reads `keyCode`, not `key`. */
const KEY_CODES: Readonly<Record<string, number>> = {
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
};

function press(fixture: ComponentFixture<ChallengeDayStrip>, key: string): void {
  const keyCode = KEY_CODES[key];
  (document.activeElement as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key, keyCode, which: keyCode, bubbles: true }),
  );
  fixture.detectChanges();
}

describe('ChallengeDayStrip', () => {
  it('renders 30 labelled buttons in one group with a single tab stop on today', () => {
    const fixture = setUp();
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(cells(fixture)).toHaveLength(30);
    expect(tabStops(fixture)).toEqual([12]);
    const today = cells(fixture)[11];
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(today.getAttribute('aria-label')).toMatch(/^Day 12 of 30, .+: Today$/);
    expect(cells(fixture)[0].getAttribute('aria-label')).toMatch(/: Missed$/);
    expect(cells(fixture)[29].getAttribute('aria-label')).toMatch(/: Coming up$/);
  });

  it('moves by one day with the arrows, and Home/End go to day 1/day 30', () => {
    const fixture = setUp();
    cells(fixture)[11].focus();
    press(fixture, 'ArrowLeft');
    expect(document.activeElement).toBe(cells(fixture)[10]);
    expect(tabStops(fixture)).toEqual([11]);
    press(fixture, 'ArrowRight');
    press(fixture, 'ArrowRight');
    expect(document.activeElement).toBe(cells(fixture)[12]);
    press(fixture, 'Home');
    expect(document.activeElement).toBe(cells(fixture)[0]);
    press(fixture, 'End');
    expect(document.activeElement).toBe(cells(fixture)[29]);
  });

  it('follows the text direction: in RTL, Right goes back a day', () => {
    const fixture = setUp('rtl');
    cells(fixture)[11].focus();
    press(fixture, 'ArrowRight');
    expect(document.activeElement).toBe(cells(fixture)[10]);
  });

  it('ignores Up and Down: the wrap is visual only', () => {
    const fixture = setUp();
    cells(fixture)[11].focus();
    press(fixture, 'ArrowDown');
    press(fixture, 'ArrowUp');
    expect(document.activeElement).toBe(cells(fixture)[11]);
  });

  it('keeps the tab stop and the same buttons when a save re-renders the cells', () => {
    const fixture = setUp();
    cells(fixture)[11].focus();
    press(fixture, 'ArrowLeft');
    const before = cells(fixture);
    fixture.componentRef.setInput(
      'cells',
      dayStates(
        test({
          checkins: [
            {
              date: TODAY,
              answers: { influence: true, promise: true, response: true, noBlame: true },
            },
          ],
        }),
        TODAY,
      ),
    );
    fixture.detectChanges();
    expect(cells(fixture).every((cell, index) => cell === before[index])).toBe(true);
    expect(tabStops(fixture)).toEqual([11]);
    expect(cells(fixture)[11].getAttribute('aria-label')).toMatch(/: Checked in$/);
  });

  it('moves the tab stop to the new today at midnight, and arrows start from the focused cell', () => {
    const fixture = setUp();
    cells(fixture)[9].focus();
    fixture.componentRef.setInput('cells', dayStates(test(), '2026-03-13'));
    fixture.componentRef.setInput('anchorDate', '2026-03-13');
    fixture.detectChanges();
    expect(tabStops(fixture)).toEqual([13]);
    press(fixture, 'ArrowLeft');
    expect(document.activeElement).toBe(cells(fixture)[8]);
  });

  it('emits the date a cell is chosen for, and marks it pressed', () => {
    const fixture = setUp();
    const chosen: string[] = [];
    fixture.componentInstance.daySelected.subscribe((date) => chosen.push(date));
    cells(fixture)[4].click();
    fixture.componentRef.setInput('selectedDate', '2026-03-05');
    fixture.detectChanges();
    expect(chosen).toEqual(['2026-03-05']);
    expect(cells(fixture)[4].getAttribute('aria-pressed')).toBe('true');
    expect(tabStops(fixture)).toEqual([5]);
  });
});
