import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
// Side-effect only: the locale date adapter reads `settings.numerals` through `featureStore`.
import '../../features/settings/settings.model';
import { CircleItemForm, ConcernPromise } from './circle-item-form';
import { Concern, ConcernFields } from './circle.model';

function concern(overrides: Partial<Concern> = {}): Concern {
  return {
    id: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'The deadline keeps moving',
    control: 'direct',
    status: 'open',
    ...overrides,
  };
}

function setUp(value: Concern, promise: ConcernPromise | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('h1-circle'),
      provideRouter([]),
      ...provideLocaleDateAdapter(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(CircleItemForm);
  fixture.componentRef.setInput('concern', value);
  fixture.componentRef.setInput('promise', promise);
  fixture.detectChanges();
  const emitted: Partial<ConcernFields>[] = [];
  fixture.componentInstance.changed.subscribe((fields) => emitted.push(fields));
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

function type(element: HTMLElement, selector: string, value: string): void {
  const field = element.querySelector(selector) as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

describe('CircleItemForm', () => {
  it('shows the three options, each with its note', () => {
    const { element } = setUp(concern());

    const options = [...element.querySelectorAll('.control-option')].map((o) => o.textContent);
    expect(options).toHaveLength(3);
    expect(options[0]).toContain('Up to me');
    expect(options[0]).toContain('Change your habit or your approach.');
    expect(options[2]).toContain("Out of anyone's hands");
  });

  it('gives every free-text field its example placeholder', () => {
    const a = setUp(concern()).element;
    const placeholders = [...a.querySelectorAll('textarea, input[placeholder]')].map((f) =>
      f.getAttribute('placeholder'),
    );
    expect(placeholders).toContain('e.g. My manager keeps changing the deadline.');
    expect(placeholders).toContain('e.g. a manager who plans ahead.');
    expect(placeholders).toContain('e.g. clear about what a change costs, in writing, each time.');
    expect(placeholders).toContain('e.g. Ask for a 10-minute chat about how deadlines get set.');
  });

  it('emits each typed field', () => {
    const { element, emitted } = setUp(concern());

    type(element, 'textarea', 'New');
    expect(emitted).toEqual([{ title: 'New' }]);
  });

  it('shows the first step, date and branch A statuses for Up to me', () => {
    const { element } = setUp(concern());

    expect(element.textContent).toContain('First step');
    expect(element.textContent).toContain('By when');
    expect(element.textContent).not.toContain('Letting it go');
    const statuses = [...element.querySelectorAll('mat-button-toggle')].map((t) =>
      t.textContent?.trim(),
    );
    expect(statuses).toEqual(['Open', 'Step taken', 'Sorted']);
  });

  it("shows the letting-go line and Open/Let go for Out of anyone's hands", () => {
    const { element } = setUp(concern({ control: 'none', firstStep: 'Kept text' }));

    expect(element.textContent).toContain('Letting it go');
    expect(element.textContent).not.toContain('First step');
    expect(element.querySelector('[placeholder*="Leave ten minutes"]')).not.toBeNull();
    const statuses = [...element.querySelectorAll('mat-button-toggle')].map((t) =>
      t.textContent?.trim(),
    );
    expect(statuses).toEqual(['Open', 'Let go']);
  });

  it('switching to a branch whose statuses exclude the current one resets it to Open', () => {
    const { fixture, emitted } = setUp(concern({ status: 'stepTaken' }));

    (fixture.componentInstance as unknown as { onControlChange(c: string): void }).onControlChange(
      'none',
    );
    expect(emitted).toEqual([{ control: 'none', status: 'open' }]);
  });

  it('offers "Make it a promise" once there is a first step and no promise', () => {
    const noStep = setUp(concern()).element;
    expect(noStep.querySelector('.make-promise-button')).toBeNull();
    TestBed.resetTestingModule();

    const { fixture, element } = setUp(concern({ firstStep: 'Ask' }));
    let requested = 0;
    fixture.componentInstance.promiseRequested.subscribe(() => requested++);
    (element.querySelector('.make-promise-button') as HTMLButtonElement).click();
    expect(requested).toBe(1);
  });

  it("replaces the button with the promise's status and a link to it", () => {
    const { element } = setUp(concern({ firstStep: 'Ask', commitmentId: 'p1' }), {
      status: 'kept',
      link: '/habits/h1/commitments/p1',
    });

    expect(element.querySelector('.make-promise-button')).toBeNull();
    expect(element.querySelector('.promise-status')?.textContent).toContain('Promise: Kept');
    const link = element.querySelector('.see-promise-link') as HTMLAnchorElement;
    expect(link.textContent).toContain('See promise');
    expect(link.getAttribute('href')).toBe('/habits/h1/commitments/p1');
  });

  it('shows the required message for a blurred empty first step', () => {
    const { fixture, element } = setUp(concern({ firstStep: '' }));
    const step = element.querySelectorAll('textarea')[1] as HTMLTextAreaElement;

    step.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(element.querySelector('#first-step-error')?.textContent).toContain(
      'Write a first step you can take yourself.',
    );
  });
});
