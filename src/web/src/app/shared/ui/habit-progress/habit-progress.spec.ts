import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HabitProgress } from './habit-progress';

@Component({
  imports: [HabitProgress],
  template: `<app-habit-progress [done]="2" [total]="5" label="2 of 5 done" />`,
})
class Host {}

describe('HabitProgress', () => {
  it('renders the label and a decorative ring at the done percentage', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.habit-progress-count')?.textContent?.trim()).toBe('2 of 5 done');
    const ring = element.querySelector('mat-progress-spinner');
    expect(ring?.getAttribute('aria-hidden')).toBe('true');
    expect(ring?.getAttribute('aria-valuenow')).toBe('40');
  });
});
