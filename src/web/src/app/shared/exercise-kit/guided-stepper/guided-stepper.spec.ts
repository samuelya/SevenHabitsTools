import { Component } from '@angular/core';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { GuidedStepContent } from './guided-step-content';
import { GuidedStepDefinition, GuidedStepper } from './guided-stepper';

@Component({
  selector: 'app-host',
  imports: [GuidedStepper, GuidedStepContent],
  template: `
    <app-guided-stepper
      [steps]="steps"
      [selectedIndex]="selectedIndex"
      (selectedIndexChange)="selectedIndex = $event"
    >
      <ng-template appGuidedStep="first">First step content</ng-template>
      <ng-template appGuidedStep="second">Second step content</ng-template>
    </app-guided-stepper>
  `,
})
class HostComponent {
  readonly steps: GuidedStepDefinition[] = [
    { key: 'first', label: 'First', done: true },
    { key: 'second', label: 'Second' },
  ];
  selectedIndex = 0;
}

function setUp(handset: boolean) {
  const state: BreakpointState = { matches: handset, breakpoints: {} };
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('exercise-kit'),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of(state), isMatched: () => handset },
      },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

describe('GuidedStepper', () => {
  it('renders every step label', () => {
    const fixture = setUp(false);

    const labels = [...fixture.nativeElement.querySelectorAll('.mat-step-text-label')].map(
      (el: Element) => el.textContent?.trim(),
    );
    expect(labels).toEqual(['First', 'Second']);
  });

  it('projects each step content by its key, not by position', () => {
    const fixture = setUp(false);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('First step content');
  });

  it('uses horizontal orientation on desktop', () => {
    const fixture = setUp(false);

    expect(fixture.nativeElement.querySelector('.mat-stepper-horizontal')).not.toBeNull();
  });

  it('uses vertical orientation on a handset', () => {
    const fixture = setUp(true);

    expect(fixture.nativeElement.querySelector('.mat-stepper-vertical')).not.toBeNull();
  });

  it('emits selectedIndexChange when the stepper advances', () => {
    const fixture = setUp(false);
    const host = fixture.componentInstance;

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    const nextButton = buttons.find((button) => button.textContent?.trim() === 'Next');
    nextButton?.click();
    fixture.detectChanges();

    expect(host.selectedIndex).toBe(1);
  });

  it('does not block forward navigation from a step with no done tracking', () => {
    const fixture = setUp(false);
    const host = fixture.componentInstance;
    host.steps[0] = { key: 'first', label: 'First' };
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    const nextButton = buttons.find((button) => button.textContent?.trim() === 'Next');
    nextButton?.click();
    fixture.detectChanges();

    expect(host.selectedIndex).toBe(1);
  });
});
