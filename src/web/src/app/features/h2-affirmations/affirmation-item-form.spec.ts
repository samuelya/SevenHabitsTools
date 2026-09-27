import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { AffirmationItemForm } from './affirmation-item-form';
import { uncheckedChecks } from './affirmations.logic';
import { Affirmation, AffirmationFields } from './affirmations.model';

function item(overrides: Partial<Affirmation> = {}): Affirmation {
  return {
    id: 'a1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    text: 'I breathe out.',
    checks: uncheckedChecks(),
    practice: [],
    ...overrides,
  };
}

function setUp(value: Affirmation, saved = true) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(AffirmationItemForm);
  fixture.componentRef.setInput('item', value);
  fixture.componentRef.setInput('saved', saved);
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<AffirmationItemForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function edits(fixture: ComponentFixture<AffirmationItemForm>): Partial<AffirmationFields>[] {
  const emitted: Partial<AffirmationFields>[] = [];
  fixture.componentInstance.changed.subscribe((edit) => emitted.push(edit));
  return emitted;
}

function textareas(fixture: ComponentFixture<AffirmationItemForm>): HTMLTextAreaElement[] {
  return [...el(fixture).querySelectorAll('textarea')];
}

describe('AffirmationItemForm', () => {
  it('gives the affirmation and the scene their prompt and the guide example as placeholder', () => {
    const fixture = setUp(item());
    const text = el(fixture).textContent ?? '';
    expect(text).toContain('One sentence: who are you in that moment?');
    expect(text).toContain("Picture it: where you are, who's there, what you feel.");
    const [affirmation, scene] = textareas(fixture);
    expect(affirmation.getAttribute('placeholder')).toBe(
      'e.g. When my son slams the door, I breathe out, lower my voice and ask what happened.',
    );
    expect(scene.getAttribute('placeholder')).toBe(
      'e.g. The hallway after school. His bag on the floor. My shoulders drop and I feel steady.',
    );
  });

  it('shows the five checks, each with its hint wired as its description', () => {
    const fixture = setUp(item());
    const labels = [...el(fixture).querySelectorAll('mat-checkbox label')].map((label) =>
      label.textContent?.trim(),
    );
    expect(labels).toEqual([
      "It's about me",
      'It says what I do, not what I stop',
      "It's in the present tense",
      'I can see it',
      'I can feel it',
    ]);
    const input = el(fixture).querySelector<HTMLInputElement>(
      '[data-check="positive"] input[type="checkbox"]',
    )!;
    const hintId = input.getAttribute('aria-describedby') ?? '';
    expect(el(fixture).querySelector(`#${hintId}`)?.textContent).toContain(
      '"I lower my voice", not "I don\'t shout".',
    );
  });

  it('emits the whole checks object when one is ticked', () => {
    const fixture = setUp(item());
    const emitted = edits(fixture);
    el(fixture)
      .querySelector<HTMLInputElement>('[data-check="visual"] input[type="checkbox"]')!
      .click();
    expect(emitted).toEqual([{ checks: { ...uncheckedChecks(), visual: true } }]);
  });

  it('emits the text and the scene as typed', () => {
    const fixture = setUp(item());
    const emitted = edits(fixture);
    const [affirmation, scene] = textareas(fixture);
    affirmation.value = 'I lower my voice.';
    affirmation.dispatchEvent(new Event('input'));
    scene.value = 'The kitchen.';
    scene.dispatchEvent(new Event('input'));
    expect(emitted).toEqual([{ text: 'I lower my voice.' }, { scene: 'The kitchen.' }]);
  });

  it('says to tick all five until complete', () => {
    const fixture = setUp(item());
    const hint = () => el(fixture).querySelector('.incomplete-hint')?.textContent?.trim();
    expect(hint()).toBe('Tick all five before you practise.');
    fixture.componentRef.setInput(
      'item',
      item({
        checks: { personal: true, positive: true, present: true, visual: true, emotional: true },
      }),
    );
    fixture.detectChanges();
    expect(hint()).toBe('');
  });

  it('shows the required message once the affirmation is emptied', () => {
    const fixture = setUp(item({ text: '' }));
    textareas(fixture)[0].dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el(fixture).querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Write the affirmation first.',
    );
  });

  it('offers Archive on a saved affirmation, disabled on a draft, and Unarchive when archived', () => {
    const draft = setUp(item(), false);
    expect(el(draft).querySelector<HTMLButtonElement>('.archive')?.disabled).toBe(true);
    TestBed.resetTestingModule();

    const fixture = setUp(item());
    const archived: boolean[] = [];
    fixture.componentInstance.archivedChange.subscribe((value) => archived.push(value));
    el(fixture).querySelector<HTMLButtonElement>('.archive')!.click();
    fixture.componentRef.setInput('item', item({ archived: true }));
    fixture.detectChanges();
    el(fixture).querySelector<HTMLButtonElement>('.unarchive')!.click();
    expect(archived).toEqual([true, false]);
  });
});
