import { Component } from '@angular/core';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { of } from 'rxjs';
import '../../../features/settings/settings.model';
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

@Component({
  selector: 'app-three-step-host',
  imports: [GuidedStepper, GuidedStepContent],
  template: `
    <app-guided-stepper
      [steps]="steps"
      [selectedIndex]="selectedIndex"
      (selectedIndexChange)="selectedIndex = $event"
    >
      <ng-template appGuidedStep="first">First step content</ng-template>
      <ng-template appGuidedStep="second">Second step content</ng-template>
      <ng-template appGuidedStep="third">Third step content</ng-template>
    </app-guided-stepper>
  `,
})
class ThreeStepHostComponent {
  readonly steps: GuidedStepDefinition[] = [
    { key: 'first', label: 'First' },
    { key: 'second', label: 'Second' },
    { key: 'third', label: 'Third' },
  ];
  selectedIndex = 0;
}

function setUp<T>(component: new () => T, handset: boolean) {
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
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}

function buttonsWithText(fixture: { nativeElement: HTMLElement }, text: string): HTMLElement[] {
  return [...fixture.nativeElement.querySelectorAll('button')].filter(
    (button) => button.textContent?.trim() === text,
  );
}

describe('GuidedStepper', () => {
  it('renders every step label', () => {
    const fixture = setUp(HostComponent, false);

    const labels = [...fixture.nativeElement.querySelectorAll('.mat-step-text-label')].map(
      (el: Element) => el.textContent?.trim(),
    );
    expect(labels).toEqual(['First', 'Second']);
  });

  it('projects each step content by its key, not by position', () => {
    const fixture = setUp(HostComponent, false);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('First step content');
  });

  it('uses horizontal orientation on desktop', () => {
    const fixture = setUp(HostComponent, false);

    expect(fixture.nativeElement.querySelector('.mat-stepper-horizontal')).not.toBeNull();
  });

  it('uses vertical orientation on a handset', () => {
    const fixture = setUp(HostComponent, true);

    expect(fixture.nativeElement.querySelector('.mat-stepper-vertical')).not.toBeNull();
  });

  it('emits selectedIndexChange when the stepper advances', () => {
    const fixture = setUp(HostComponent, false);
    const host = fixture.componentInstance;

    buttonsWithText(fixture, 'Next')[0].click();
    fixture.detectChanges();

    expect(host.selectedIndex).toBe(1);
  });

  it('does not block forward navigation from a step with no done tracking', () => {
    const fixture = setUp(HostComponent, false);
    const host = fixture.componentInstance;
    host.steps[0] = { key: 'first', label: 'First' };
    fixture.detectChanges();

    buttonsWithText(fixture, 'Next')[0].click();
    fixture.detectChanges();

    expect(host.selectedIndex).toBe(1);
  });

  it('un-ticks a step when its done flag regresses back to undefined', () => {
    // Regression test for a review finding: the effect only ever set `completed = true`, so a
    // step that arrives already done (e.g. reloaded data, before the user has interacted with it
    // this session) but is then emptied out kept its green check while the checklist correctly
    // listed it as unmet. Drives `GuidedStepper` directly with `setInput` (rather than through a
    // host component's template binding) so reassigning `steps` reliably updates the signal input
    // between assertions.
    const state: BreakpointState = { matches: false, breakpoints: {} };
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of(state), isMatched: () => false },
        },
      ],
    });
    const fixture = TestBed.createComponent(GuidedStepper);
    const steps: GuidedStepDefinition[] = [
      { key: 'first', label: 'First' },
      { key: 'second', label: 'Second' },
      { key: 'third', label: 'Third' },
    ];
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();
    const stepIcon = () =>
      [...fixture.nativeElement.querySelectorAll('mat-step-header')][2].querySelector(
        '.mat-step-icon',
      ) as HTMLElement;

    fixture.componentRef.setInput('steps', [
      steps[0],
      steps[1],
      { key: 'third', label: 'Third', done: true },
    ]);
    fixture.detectChanges();
    expect(stepIcon().className).not.toContain('mat-step-icon-state-number');

    // The user deletes the content that completed the step.
    fixture.componentRef.setInput('steps', [steps[0], steps[1], { key: 'third', label: 'Third' }]);
    fixture.detectChanges();
    expect(stepIcon().className).toContain('mat-step-icon-state-number');
  });

  it('un-ticks a regressed step even after leaving it once latched `interacted`', () => {
    // Regression test for the round-4 review finding: the round-3 fix cleared `_completedOverride`
    // to `null` on regression, but `CdkStep.interacted` latches `true` the moment the stepper
    // *leaves* a step — including this step, on the "Next" click below — and is never reset by
    // clearing the override alone, so `completed` fell back to `interacted && …` and stayed `true`.
    // The test above never navigates, so `interacted` stays `false` throughout and never exercises
    // that path; this one drives real "Next"/"Back" clicks to latch it for real.
    const state: BreakpointState = { matches: false, breakpoints: {} };
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of(state), isMatched: () => false },
        },
      ],
    });
    const fixture = TestBed.createComponent(GuidedStepper);
    fixture.componentRef.setInput('steps', [
      { key: 'first', label: 'First' },
      { key: 'second', label: 'Second' },
      { key: 'third', label: 'Third', done: true },
    ]);
    fixture.detectChanges();
    const thirdStepIcon = () =>
      [...fixture.nativeElement.querySelectorAll('mat-step-header')][2].querySelector(
        '.mat-step-icon',
      ) as HTMLElement;

    // Visit step 3 and leave it again, the way skipping ahead and coming back would — this is what
    // latches its `interacted` flag. Its own header shows "number", not "done", the whole time
    // it's the selected step (`CdkStep.indicatorType` always does that), so the tick is only
    // observable once another step is selected.
    buttonsWithText(fixture, 'Next')[0].click();
    fixture.detectChanges();
    buttonsWithText(fixture, 'Next')[1].click();
    fixture.detectChanges();
    buttonsWithText(fixture, 'Back')[1].click();
    fixture.detectChanges();
    expect(thirdStepIcon().className).not.toContain('mat-step-icon-state-number');

    // The user deletes the content that completed step 3, while sitting elsewhere.
    fixture.componentRef.setInput('steps', [
      { key: 'first', label: 'First' },
      { key: 'second', label: 'Second' },
      { key: 'third', label: 'Third' },
    ]);
    fixture.detectChanges();

    expect(thirdStepIcon().className).toContain('mat-step-icon-state-number');
  });

  it('does not render "Back" on the first step', () => {
    const fixture = setUp(HostComponent, false);

    // Every step's own body is in the DOM at once (CSS hides the unselected ones), so this counts
    // across both steps: only the second (non-first) one renders "Back".
    expect(buttonsWithText(fixture, 'Back')).toHaveLength(1);
  });

  it('does not render "Next" on the last step', () => {
    const fixture = setUp(HostComponent, false);

    expect(buttonsWithText(fixture, 'Next')).toHaveLength(1);
  });

  it('renders both "Back" and "Next" on a middle step', () => {
    const fixture = setUp(ThreeStepHostComponent, false);

    expect(buttonsWithText(fixture, 'Back')).toHaveLength(2);
    expect(buttonsWithText(fixture, 'Next')).toHaveLength(2);
  });

  it('gives each step header an aria-label naming its number and its own label', () => {
    const fixture = setUp(HostComponent, false);

    const headers = [...fixture.nativeElement.querySelectorAll('mat-step-header')];
    expect(headers[0].getAttribute('aria-label')).toBe('Step 1: First');
    expect(headers[1].getAttribute('aria-label')).toBe('Step 2: Second');
  });
});
