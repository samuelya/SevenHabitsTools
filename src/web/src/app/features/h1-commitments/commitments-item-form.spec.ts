import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import '../../features/settings/settings.model';
import { Commitment } from '../../shared/commitments/commitments.model';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { CommitmentsItemForm } from './commitments-item-form';

function promise(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'c1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    text: 'Call Mum on Sunday afternoon.',
    toWhom: 'self',
    status: 'open',
    ...overrides,
  };
}

function setUp(value: Commitment): ComponentFixture<CommitmentsItemForm> {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter([]),
      ...provideLocaleDateAdapter(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(CommitmentsItemForm);
  fixture.componentRef.setInput('commitment', value);
  fixture.detectChanges();
  document.body.appendChild(fixture.nativeElement);
  return fixture;
}

function el(fixture: ComponentFixture<CommitmentsItemForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<CommitmentsItemForm>, label: string): HTMLButtonElement {
  return [...el(fixture).querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label),
  ) as HTMLButtonElement;
}

describe('CommitmentsItemForm', () => {
  it('gives every free-text field its label, prompt and placeholder', () => {
    const fixture = setUp(promise({ toWhom: 'other' }));
    const text = el(fixture).textContent ?? '';
    expect(text).toContain("What's one small thing you'll do, for sure?");
    expect(text).toContain('Who did you promise?');
    expect(text).toContain('When will it be done? Soon is better.');
    const placeholders = [...el(fixture).querySelectorAll('textarea, input[placeholder]')].map(
      (field) => field.getAttribute('placeholder'),
    );
    expect(placeholders).toContain('e.g. Call Mum on Sunday afternoon.');
    expect(placeholders).toContain('e.g. Dina');
  });

  it('emits the typed promise, recipient and a picked due date', () => {
    const fixture = setUp(promise());
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((edit) => emitted.push(edit));
    const textarea = el(fixture).querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Call Dad.';
    textarea.dispatchEvent(new Event('input'));
    const dateInput = el(fixture).querySelector('.date-field input') as HTMLInputElement;
    dateInput.value = '3/14/2026';
    dateInput.dispatchEvent(new Event('input'));
    dateInput.dispatchEvent(new Event('change'));
    expect(emitted).toContainEqual({ text: 'Call Dad.' });
    expect(emitted).toContainEqual({ dueDate: '2026-03-14' });
  });

  it('clears the due date when the field is emptied, and ignores text that is not a date', () => {
    const fixture = setUp(promise({ dueDate: '2026-03-14' }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((edit) => emitted.push(edit));
    const dateInput = el(fixture).querySelector('.date-field input') as HTMLInputElement;
    dateInput.value = 'soon';
    dateInput.dispatchEvent(new Event('input'));
    dateInput.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([]);
    dateInput.value = '';
    dateInput.dispatchEvent(new Event('input'));
    dateInput.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([{ dueDate: '' }]);
  });

  it('offers Kept, Broken and Withdraw while open, disabled for an unsaved draft', () => {
    const fixture = setUp(promise());
    const resolved: string[] = [];
    fixture.componentInstance.resolved.subscribe((status) => resolved.push(status));
    button(fixture, 'Kept').click();
    button(fixture, 'Broken').click();
    button(fixture, 'Withdraw').click();
    expect(resolved).toEqual(['kept', 'broken', 'withdrawn']);
    expect(button(fixture, 'Reopen')).toBeUndefined();

    fixture.componentRef.setInput('canResolve', false);
    fixture.detectChanges();
    expect(button(fixture, 'Kept').disabled).toBe(true);
  });

  it('offers only Reopen once resolved, with the promise read-only', () => {
    const fixture = setUp(promise({ status: 'kept', resolvedOn: '2026-03-10' }));
    let reopened = 0;
    fixture.componentInstance.reopened.subscribe(() => reopened++);
    expect(button(fixture, 'Withdraw')).toBeUndefined();
    button(fixture, 'Reopen').click();
    expect(reopened).toBe(1);
    expect((el(fixture).querySelector('textarea') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(el(fixture).textContent).toContain('Mar 10, 2026');
  });

  it('reveals the repair note on Broken and moves focus to it', async () => {
    const fixture = setUp(promise());
    expect(el(fixture).querySelector('textarea[placeholder^="e.g. I underestimated"]')).toBeNull();
    fixture.componentRef.setInput(
      'commitment',
      promise({ status: 'broken', resolvedOn: '2026-03-10' }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const note = el(fixture).querySelector(
      'textarea[placeholder^="e.g. I underestimated"]',
    ) as HTMLTextAreaElement;
    expect(note).not.toBeNull();
    expect(document.activeElement).toBe(note);
  });

  it('does not steal focus when opening a promise that is already broken', async () => {
    const fixture = setUp(promise({ status: 'broken', resolvedOn: '2026-03-10' }));
    await fixture.whenStable();
    const note = el(fixture).querySelector('textarea[placeholder^="e.g. I underestimated"]');
    expect(document.activeElement).not.toBe(note);
  });

  it('links the source line when a route is given', () => {
    const fixture = setUp(promise({ source: { exerciseId: 'h1-circle' } }));
    fixture.componentRef.setInput('sourceLine', 'From: Your influence');
    fixture.componentRef.setInput('sourceRoute', 'habits/h1/circle');
    fixture.detectChanges();
    const link = el(fixture).querySelector('a.source-line') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('From: Your influence');
    expect(link.getAttribute('href')).toBe('/habits/h1/circle');
  });
});
