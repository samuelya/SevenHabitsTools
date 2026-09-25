import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { provideLocaleDateAdapter } from '../../shared/ui/locale-date-adapter/locale-date-adapter';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
// Side-effect only: the locale date adapter reads `settings.numerals` through `featureStore`.
import '../../features/settings/settings.model';
import { RehearsalItemForm, RehearsalPromise } from './rehearsal-item-form';
import { Rehearsal, RehearsalFields } from './rehearsal.model';

function rehearsal(overrides: Partial<Rehearsal> = {}): Rehearsal {
  return {
    id: 'r1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    trigger: 'Sunday lunch',
    ...overrides,
  };
}

function setUp(value: Rehearsal, promise: RehearsalPromise | null = null, followUpOpen = false) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('h1-rehearsal'),
      provideRouter([]),
      ...provideLocaleDateAdapter(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(RehearsalItemForm);
  fixture.componentRef.setInput('rehearsal', value);
  fixture.componentRef.setInput('promise', promise);
  fixture.componentRef.setInput('followUpOpen', followUpOpen);
  fixture.detectChanges();
  const emitted: Partial<RehearsalFields>[] = [];
  fixture.componentInstance.changed.subscribe((fields) => emitted.push(fields));
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

function textareas(element: HTMLElement): HTMLTextAreaElement[] {
  return [...element.querySelectorAll('textarea')];
}

describe('RehearsalItemForm', () => {
  it('shows the four parts in order, each under its heading', () => {
    const { element } = setUp(rehearsal());

    const legends = [...element.querySelectorAll('legend')].map((l) => l.textContent?.trim());
    expect(legends).toEqual([
      'The moment',
      'What usually happens',
      "What you'll do instead",
      'Your promise',
    ]);
  });

  it('gives every free-text field its example placeholder', () => {
    const { element } = setUp(rehearsal());
    const placeholders = [...element.querySelectorAll('textarea, input[placeholder]')].map((f) =>
      f.getAttribute('placeholder'),
    );
    expect(placeholders).toEqual([
      'e.g. Sunday lunch, when Dad brings up my job again.',
      'e.g. I get short with him and leave the table early.',
      'e.g. The whole afternoon feels ruined, and Mum ends up upset.',
      'e.g. I take a breath and say: "I know you worry. Ask me one question about it and I\'ll answer properly." Then I ask about his week.',
      "e.g. On Sunday I'll answer Dad calmly and ask him one question back.",
    ]);
  });

  it('emits each typed field', () => {
    const { element, emitted } = setUp(rehearsal());
    const promise = element.querySelector(
      'input[placeholder^="e.g. On Sunday"]',
    ) as HTMLInputElement;

    textareas(element)[0].value = 'New';
    textareas(element)[0].dispatchEvent(new Event('input'));
    promise.value = 'Stay calm';
    promise.dispatchEvent(new Event('input'));
    expect(emitted).toEqual([{ trigger: 'New' }, { promise: 'Stay calm' }]);
  });

  it('shows the scene hint, and the required message only after leaving a short scene', () => {
    const { fixture, element } = setUp(rehearsal({ chosenResponse: 'Too short.' }));
    const scene = textareas(element)[3];

    expect(element.querySelector('#scene-hint')?.textContent).toContain('Two or three sentences');
    expect(element.querySelector('#scene-error')).toBeNull();

    scene.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(element.querySelector('#scene-error')?.textContent).toContain('Write a little more');
    expect(scene.getAttribute('aria-describedby')).toContain('scene-error');

    fixture.componentRef.setInput('rehearsal', rehearsal({ chosenResponse: 'x'.repeat(60) }));
    fixture.detectChanges();
    expect(element.querySelector('#scene-error')).toBeNull();
  });

  it('says the promise is tracked in Your promises, and shows its status with a link', () => {
    const { element } = setUp(rehearsal({ promise: 'Stay calm', commitmentId: 'p1' }), {
      status: 'open',
      link: '/habits/h1/commitments/p1',
    });

    expect(element.querySelector('#promise-hint')?.textContent).toContain('Your promises');
    expect(element.querySelector('.promise-status')?.textContent).toContain('Promise: Open');
    const link = element.querySelector('.see-promise-link') as HTMLAnchorElement;
    expect(link.textContent).toContain('See promise');
    expect(link.getAttribute('href')).toBe('/habits/h1/commitments/p1');
  });

  it('shows Afterwards only when the page opens it', () => {
    expect(setUp(rehearsal()).element.querySelector('app-rehearsal-follow-up')).toBeNull();
    TestBed.resetTestingModule();

    const { element } = setUp(rehearsal(), null, true);
    expect(element.querySelector('app-rehearsal-follow-up')?.textContent).toContain('Afterwards');
  });

  it('shows the required message for a blurred empty moment', () => {
    const { fixture, element } = setUp(rehearsal({ trigger: '' }));

    textareas(element)[0].dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(element.querySelector('#trigger-error')?.textContent).toContain(
      'Name the moment first.',
    );
  });
});
