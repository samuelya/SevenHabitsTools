import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import '../../features/settings/settings.model';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { ProjectItemForm } from './project-item-form';
import { Project, ProjectFields } from '../../shared/projects/projects.model';

function item(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    name: 'Lunch',
    criteria: [],
    steps: [],
    status: 'planning',
    ...overrides,
  };
}

const STEPS = [
  { key: 'a', text: 'Ask', done: true },
  { key: 'b', text: 'Book', done: false },
];

function setUp(value: Project) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      ...provideLocaleDateAdapter(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(ProjectItemForm);
  fixture.componentRef.setInput('item', value);
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<ProjectItemForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function query<T extends HTMLElement>(
  fixture: ComponentFixture<ProjectItemForm>,
  selector: string,
): T {
  return el(fixture).querySelector(selector) as T;
}

function edits(fixture: ComponentFixture<ProjectItemForm>): Partial<ProjectFields>[] {
  const emitted: Partial<ProjectFields>[] = [];
  fixture.componentInstance.changed.subscribe((edit) => emitted.push(edit));
  return emitted;
}

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ProjectItemForm', () => {
  it('gives each text field its prompt and the guide example as placeholder', () => {
    const fixture = setUp(item({ criteria: [''] }));
    const text = el(fixture).textContent ?? '';
    expect(text).toContain("What's it called? A few words.");
    expect(text).toContain("It's over and it went well. What do you see?");
    expect(text).toContain('Up to five things that will be true if it worked.');
    expect(text).toContain('Now the steps, from where you are to that picture.');
    expect(query(fixture, '.name-field').getAttribute('placeholder')).toBe(
      "e.g. Mum's 70th birthday lunch",
    );
    expect(query(fixture, '.result-field').getAttribute('placeholder')).toContain(
      'e.g. Everyone she loves in one room',
    );
    expect(query(fixture, '.criterion-field').getAttribute('placeholder')).toBe(
      'e.g. All four siblings came.',
    );
    expect(query(fixture, '.new-step-field').getAttribute('placeholder')).toBe(
      'e.g. Ask each sibling which Sunday works.',
    );
  });

  it('locks the steps with a hint until "What done looks like" has text', () => {
    const fixture = setUp(item());
    const field = query<HTMLInputElement>(fixture, '.new-step-field');
    expect(field.disabled).toBe(true);
    expect(query(fixture, '#project-steps-hint').textContent).toContain(
      'Write what done looks like first, then the steps will open.',
    );
    fixture.componentRef.setInput('item', item({ desiredResult: 'Everyone there.' }));
    fixture.detectChanges();
    expect(field.disabled).toBe(false);
    expect(query(fixture, '#project-steps-hint').textContent?.trim()).toBe('');
  });

  it('emits name and desired result edits and shows the required message when emptied', () => {
    const fixture = setUp(item());
    const emitted = edits(fixture);
    type(query(fixture, '.name-field'), '');
    fixture.detectChanges();
    expect(emitted).toEqual([{ name: '' }]);
    fixture.componentRef.setInput('item', item({ name: '' }));
    fixture.detectChanges();
    expect(query(fixture, '#project-name-error').textContent).toContain('Name the project first.');
    type(query(fixture, '.result-field'), 'A lunch');
    expect(emitted.at(-1)).toEqual({ desiredResult: 'A lunch' });
  });

  it('adds a step at the end on Enter and clears the field once it is stored', () => {
    const fixture = setUp(item({ desiredResult: 'Everyone there.', steps: STEPS }));
    const emitted = edits(fixture);
    const field = query<HTMLInputElement>(fixture, '.new-step-field');
    type(field, 'Scan photos');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    const steps = emitted[0].steps!;
    expect(steps.map((step) => step.text)).toEqual(['Ask', 'Book', 'Scan photos']);
    fixture.componentRef.setInput('item', item({ desiredResult: 'Everyone there.', steps }));
    fixture.detectChanges();
    expect(field.value).toBe('');
  });

  it('moves, ticks and removes steps through labelled buttons', () => {
    const fixture = setUp(item({ desiredResult: 'x', steps: STEPS }));
    const emitted = edits(fixture);
    const rows = el(fixture).querySelectorAll('.step-row');
    const firstUp = rows[0].querySelector('.move-up') as HTMLButtonElement;
    expect(firstUp.getAttribute('aria-disabled')).toBe('true');
    expect(firstUp.getAttribute('aria-label')).toBe('Move up, Step 1');
    firstUp.click();
    expect(emitted).toEqual([]);
    (rows[1].querySelector('.move-up') as HTMLButtonElement).click();
    expect(emitted[0].steps!.map((step) => step.key)).toEqual(['b', 'a']);
    (rows[1].querySelector('.step-done input') as HTMLInputElement).click();
    expect(emitted[1].steps![1]).toEqual({ key: 'b', text: 'Book', done: true });
    (rows[0].querySelector('.remove-step') as HTMLButtonElement).click();
    expect(emitted[2].steps!.map((step) => step.key)).toEqual(['b']);
  });

  it('offers "Mark project Done" once every step is ticked', () => {
    const ticked = STEPS.map((step) => ({ ...step, done: true }));
    const fixture = setUp(item({ desiredResult: 'x', steps: STEPS }));
    expect(query(fixture, '.mark-project-done')).toBeNull();
    fixture.componentRef.setInput('item', item({ desiredResult: 'x', steps: ticked }));
    fixture.detectChanges();
    const emitted = edits(fixture);
    expect(el(fixture).textContent).toContain('Every step is ticked. Is the picture true?');
    query<HTMLButtonElement>(fixture, '.mark-project-done').click();
    expect(emitted).toEqual([{ status: 'done' }]);
    fixture.componentRef.setInput(
      'item',
      item({ desiredResult: 'x', steps: ticked, status: 'done' }),
    );
    fixture.detectChanges();
    expect(query(fixture, '.mark-project-done')).toBeNull();
  });

  it('clears a step date from the keyboard and keeps a half-typed one across re-renders', () => {
    const dated = [{ key: 'a', text: 'Ask', done: false, date: '2026-09-20' }];
    const fixture = setUp(item({ desiredResult: 'x', steps: dated }));
    const emitted = edits(fixture);
    const field = query<HTMLInputElement>(fixture, '.step-date-field');
    expect(field.value).not.toBe('');

    type(field, 'Sept');
    fixture.componentRef.setInput(
      'item',
      item({ desiredResult: 'x', name: 'Lunch!', steps: dated }),
    );
    fixture.detectChanges();
    expect(field.value).toBe('Sept');
    field.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([]);

    type(field, '');
    field.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([{ steps: [{ key: 'a', text: 'Ask', done: false }] }]);
    fixture.componentRef.setInput('item', item({ desiredResult: 'x', steps: emitted[0].steps }));
    fixture.detectChanges();
    expect(field.value).toBe('');
  });

  it('moves focus to the status group after "Mark project Done"', async () => {
    const ticked = STEPS.map((step) => ({ ...step, done: true }));
    const fixture = setUp(item({ desiredResult: 'x', steps: ticked }));
    const button = query<HTMLButtonElement>(fixture, '.mark-project-done');
    button.focus();
    button.click();
    fixture.componentRef.setInput(
      'item',
      item({ desiredResult: 'x', steps: ticked, status: 'done' }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const active = document.activeElement as HTMLElement;
    expect(active.closest('.status')).not.toBeNull();
    expect(active.textContent?.trim()).toBe('Done');
  });

  it('moves focus to the previous step after a removal, never to a disabled field', async () => {
    const three = [...STEPS, { key: 'c"]', text: 'Cake', done: false }];
    const fixture = setUp(item({ desiredResult: 'x', steps: three }));
    const emitted = edits(fixture);
    const removeButtons = () => el(fixture).querySelectorAll<HTMLButtonElement>('.remove-step');
    removeButtons()[2].focus();
    removeButtons()[2].click();
    fixture.componentRef.setInput('item', item({ desiredResult: 'x', steps: emitted[0].steps }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect((document.activeElement as HTMLInputElement).value).toBe('Book');

    // The first step has no previous one: focus goes to the step now first. With the steps locked
    // (no desired result) and none left, it skips the disabled "Next step" for the result field.
    removeButtons()[0].click();
    fixture.componentRef.setInput('item', item({ desiredResult: 'x', steps: emitted[1].steps }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect((document.activeElement as HTMLInputElement).value).toBe('Book');
    removeButtons()[0].click();
    fixture.componentRef.setInput('item', item({ steps: emitted[2].steps }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.classList.contains('result-field')).toBe(true);
  });

  it('adds criteria up to five, then explains the limit', () => {
    const fixture = setUp(item({ criteria: ['a', 'b', 'c', 'd'] }));
    const emitted = edits(fixture);
    query<HTMLButtonElement>(fixture, '.add-criterion').click();
    expect(emitted[0].criteria).toEqual(['a', 'b', 'c', 'd', '']);
    fixture.componentRef.setInput('item', item({ criteria: ['a', 'b', 'c', 'd', 'e'] }));
    fixture.detectChanges();
    query<HTMLButtonElement>(fixture, '.add-criterion').click();
    expect(emitted).toHaveLength(1);
    expect(el(fixture).textContent).toContain('Five is enough.');
    (el(fixture).querySelectorAll('.remove-criterion')[1] as HTMLButtonElement).click();
    expect(emitted[1].criteria).toEqual(['a', 'c', 'd', 'e']);
  });

  it('emits a status change and puts the toggle back to the stored value', () => {
    const fixture = setUp(item());
    const emitted = edits(fixture);
    const buttons = el(fixture).querySelectorAll<HTMLButtonElement>('.status button');
    expect([...buttons].map((button) => button.textContent?.trim())).toEqual([
      'Planning',
      'Under way',
      'Done',
      'Dropped',
    ]);
    buttons[1].click();
    fixture.detectChanges();
    expect(emitted).toEqual([{ status: 'underWay' }]);
  });
});
