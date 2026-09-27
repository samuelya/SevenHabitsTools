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

  describe('done flags (#61)', () => {
    function setUpDirect(steps: GuidedStepDefinition[]) {
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
      // Driven through `setInput` so each new `steps` array reliably reaches the signal input.
      const fixture = TestBed.createComponent(GuidedStepper);
      fixture.componentRef.setInput('steps', steps);
      fixture.detectChanges();
      const headers = () => [...fixture.nativeElement.querySelectorAll('mat-step-header')];
      return {
        fixture,
        setSteps: (next: GuidedStepDefinition[]) => {
          fixture.componentRef.setInput('steps', next);
          fixture.detectChanges();
        },
        selected: () =>
          headers().findIndex((header: Element) => header.getAttribute('aria-selected') === 'true'),
        // A header shows "number" while its step is not complete (and always while selected).
        ticked: (index: number) =>
          !(headers()[index].querySelector('.mat-step-icon') as HTMLElement).className.includes(
            'mat-step-icon-state-number',
          ),
        click: (element: HTMLElement) => {
          element.click();
          fixture.detectChanges();
        },
        headers,
      };
    }

    const plain = (): GuidedStepDefinition[] => [
      { key: 'first', label: 'First' },
      { key: 'second', label: 'Second' },
      { key: 'third', label: 'Third' },
    ];

    it('does not tick a step the user skipped with "Next"', () => {
      const stepper = setUpDirect(plain());

      stepper.click(buttonsWithText(stepper.fixture, 'Next')[0]);

      expect(stepper.selected()).toBe(1);
      expect(stepper.ticked(0)).toBe(false);
    });

    it('keeps "Next" working after an unrelated steps change', () => {
      const stepper = setUpDirect(plain());
      stepper.click(buttonsWithText(stepper.fixture, 'Next')[0]);

      stepper.setSteps(plain());
      stepper.click(buttonsWithText(stepper.fixture, 'Next')[1]);

      expect(stepper.selected()).toBe(2);
    });

    it('un-ticks a step whose done goes back, and still lets the user past it', () => {
      const done = plain().map((step) => ({ ...step, done: true }));
      const stepper = setUpDirect(done);
      stepper.click(buttonsWithText(stepper.fixture, 'Next')[0]);
      stepper.click(buttonsWithText(stepper.fixture, 'Back')[0]);
      expect(stepper.ticked(1)).toBe(true);

      // The user empties steps 1 and 2 while sitting on step 1.
      stepper.setSteps([plain()[0], plain()[1], done[2]]);
      expect(stepper.ticked(1)).toBe(false);
      expect(stepper.ticked(2)).toBe(true);

      stepper.click(buttonsWithText(stepper.fixture, 'Next')[0]);
      expect(stepper.selected()).toBe(1);
      stepper.click(buttonsWithText(stepper.fixture, 'Next')[1]);
      expect(stepper.selected()).toBe(2);
    });

    it('lets a header click reach any step, done or not', () => {
      const stepper = setUpDirect([plain()[0], { ...plain()[1], done: true }, plain()[2]]);

      stepper.click(stepper.headers()[2] as HTMLElement);

      expect(stepper.selected()).toBe(2);
      expect(stepper.ticked(0)).toBe(false);
      expect(stepper.ticked(1)).toBe(true);
    });
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
