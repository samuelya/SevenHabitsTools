import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { ChallengeDayDetail } from './challenge-day-detail';
import type { DayCell } from './challenge.logic';

const missed = (day: number): DayCell => ({
  day,
  date: `2026-03-0${day}`,
  state: 'missed',
  isToday: false,
});

function setUp(): ComponentFixture<ChallengeDayDetail> {
  TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  const fixture = TestBed.createComponent(ChallengeDayDetail);
  fixture.componentRef.setInput('cell', missed(3));
  fixture.componentRef.setInput('canSkip', true);
  fixture.detectChanges();
  return fixture;
}

function reasonInput(fixture: ComponentFixture<ChallengeDayDetail>): HTMLInputElement {
  return (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
}

describe('ChallengeDayDetail', () => {
  it('emits the typed reason on "Mark skipped"', () => {
    const fixture = setUp();
    const skipped: string[] = [];
    fixture.componentInstance.skipped.subscribe((reason) => skipped.push(reason));
    reasonInput(fixture).value = 'Ill in bed all day.';
    reasonInput(fixture).dispatchEvent(new Event('input'));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.skip-button')!
      .click();
    expect(skipped).toEqual(['Ill in bed all day.']);
  });

  // Review finding 3 (PR #286): the page reuses this component across days.
  it('clears the reason when another day is selected', () => {
    const fixture = setUp();
    const skipped: string[] = [];
    fixture.componentInstance.skipped.subscribe((reason) => skipped.push(reason));
    reasonInput(fixture).value = 'Ill in bed all day.';
    reasonInput(fixture).dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.componentRef.setInput('cell', missed(5));
    fixture.detectChanges();
    expect(reasonInput(fixture).value).toBe('');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.skip-button')!
      .click();
    expect(skipped).toEqual(['']);
  });
});
