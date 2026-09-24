import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { MaturityAssessmentForm } from './maturity-assessment-form';
import { MaturityArea, MaturityAssessment } from './maturity.model';

/** Shared by the form's two spec files (phase 1: areas, phase 2: rating), which the 500-line rule
 * keeps apart. Test-only: nothing in the app imports it. */

export const LABELS = {
  work: 'Work',
  family: 'Family',
  money: 'Money',
  health: 'Health',
  learning: 'Learning',
  community: 'Community',
  friendships: 'Friendships',
};

export function area(overrides: Partial<MaturityArea> = {}): MaturityArea {
  return { id: 'ar1', key: 'work', ...overrides };
}

export function assessment(overrides: Partial<MaturityAssessment> = {}): MaturityAssessment {
  return {
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-01',
    areas: [],
    ...overrides,
  };
}

export interface Setup {
  readonly fixture: ComponentFixture<MaturityAssessmentForm>;
  readonly host: HTMLElement;
  /** Every `areas` value emitted, latest last. */
  readonly emitted: MaturityArea[][];
  /** How many times Continue was reported. */
  readonly continued: () => number;
  /** Every area id whose removal the form asked the page to confirm. */
  readonly removeRequests: string[];
  /** Feeds a new value in, as the page would after a confirmed removal. */
  readonly setAreas: (areas: MaturityArea[]) => void;
}

/** Mounts the form and, like the page, feeds each emitted change back in as the new value. */
export function setUp(
  initial: MaturityAssessment,
  options: { handset?: boolean; isNew?: boolean; feedBack?: boolean } = {},
): Setup {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-maturity')],
  });
  const fixture = TestBed.createComponent(MaturityAssessmentForm);
  const emitted: MaturityArea[][] = [];
  let current = initial;
  fixture.componentRef.setInput('assessment', current);
  fixture.componentRef.setInput('builtInLabels', LABELS);
  fixture.componentRef.setInput('handset', options.handset ?? false);
  fixture.componentRef.setInput('isNew', options.isNew ?? false);
  fixture.componentInstance.changed.subscribe((fields) => {
    if (fields.areas) {
      emitted.push([...fields.areas]);
      if (options.feedBack === false) {
        return;
      }
      current = { ...current, areas: fields.areas };
      fixture.componentRef.setInput('assessment', current);
    }
  });
  let continued = 0;
  fixture.componentInstance.continued.subscribe(() => continued++);
  const removeRequests: string[] = [];
  fixture.componentInstance.areaRemoveRequested.subscribe((id) => removeRequests.push(id));
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
    emitted,
    continued: () => continued,
    removeRequests,
    setAreas: (areas) => {
      current = { ...current, areas };
      fixture.componentRef.setInput('assessment', current);
      fixture.detectChanges();
    },
  };
}

export function typeCustomName(setup: Setup, value: string): HTMLInputElement {
  const input = setup.host.querySelector('.custom-area input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  setup.fixture.detectChanges();
  return input;
}

export function submitCustomName(setup: Setup): void {
  (setup.host.querySelector('.custom-area') as HTMLFormElement).dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
  setup.fixture.detectChanges();
}

export function chips(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('.area-chip'));
}

export function chipLabel(button: HTMLButtonElement): string | undefined {
  return button.querySelector('.area-chip-label')?.textContent?.trim();
}

export function chip(host: HTMLElement, label: string): HTMLButtonElement {
  const found = chips(host).find((button) => chipLabel(button) === label);
  if (!found) {
    throw new Error(`No chip "${label}"`);
  }
  return found;
}

export function click(setup: Setup, selector: string): void {
  (setup.host.querySelector(selector) as HTMLElement).click();
  setup.fixture.detectChanges();
}
