import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { By } from '@angular/platform-browser';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { InspirationItemForm } from './inspiration-item-form';
import { Inspiration, InspirationFields } from './inspiration.model';

function item(overrides: Partial<Inspiration> = {}): Inspiration {
  return {
    id: 'i1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    text: 'A line',
    kind: 'saying',
    tags: [],
    ...overrides,
  };
}

function setUp(value: Inspiration, usedTags: readonly string[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(InspirationItemForm);
  fixture.componentRef.setInput('item', value);
  fixture.componentRef.setInput('usedTags', usedTags);
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<InspirationItemForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function edits(fixture: ComponentFixture<InspirationItemForm>): Partial<InspirationFields>[] {
  const emitted: Partial<InspirationFields>[] = [];
  fixture.componentInstance.changed.subscribe((edit) => emitted.push(edit));
  return emitted;
}

function tagInput(fixture: ComponentFixture<InspirationItemForm>): HTMLInputElement {
  return el(fixture).querySelector('.tag-input') as HTMLInputElement;
}

/** Types `value` into the tag field and leaves it (blur adds, as Enter and comma do). */
function typeTag(fixture: ComponentFixture<InspirationItemForm>, value: string): void {
  const input = tagInput(fixture);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
  fixture.detectChanges();
}

describe('InspirationItemForm', () => {
  it('gives the line, source and tags their prompt and the guide example as placeholder', () => {
    const fixture = setUp(item());
    const text = el(fixture).textContent ?? '';
    expect(text).toContain('Write it the way you remember it.');
    expect(text).toContain('Who said it, or where were you?');
    expect(text).toContain('One or two words to find it later');
    expect(el(fixture).querySelector('textarea')?.getAttribute('placeholder')).toBe(
      "e.g. Nobody on their deathbed wished they'd answered more email.",
    );
    expect(el(fixture).querySelector('input[type="text"]')?.getAttribute('placeholder')).toBe(
      'e.g. My uncle, at his retirement dinner.',
    );
    expect(tagInput(fixture).getAttribute('placeholder')).toBe('e.g. time');
  });

  it('emits the line and the source as typed', () => {
    const fixture = setUp(item());
    const emitted = edits(fixture);
    const text = el(fixture).querySelector('textarea')!;
    text.value = 'New line';
    text.dispatchEvent(new Event('input'));
    const source = el(fixture).querySelector<HTMLInputElement>('input[type="text"]')!;
    source.value = 'Uncle';
    source.dispatchEvent(new Event('input'));
    expect(emitted).toEqual([{ text: 'New line' }, { source: 'Uncle' }]);
  });

  it('says the line is required once it is left empty', () => {
    const fixture = setUp(item({ text: '' }));
    expect(el(fixture).querySelector('[role="alert"]')).toBeNull();
    el(fixture).querySelector('textarea')!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'Write the line first.',
    );
  });

  it('adds a typed tag normalised and clears the field', () => {
    const fixture = setUp(item({ tags: ['time'] }));
    const emitted = edits(fixture);
    typeTag(fixture, ' Work ');
    expect(emitted).toEqual([{ tags: ['time', 'work'] }]);
    expect(tagInput(fixture).value).toBe('');
  });

  it('commits typed tag text on a blur with the suggestions open, once they close', () => {
    const fixture = setUp(item(), ['family', 'work']);
    const emitted = edits(fixture);
    const input = tagInput(fixture);
    input.focus();
    input.value = 'wor';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const trigger = fixture.debugElement
      .query(By.directive(MatAutocompleteTrigger))
      .injector.get(MatAutocompleteTrigger);
    trigger.openPanel();
    fixture.detectChanges();
    expect(trigger.panelOpen).toBe(true);

    input.blur();
    fixture.detectChanges();
    expect(emitted).toEqual([]);
    trigger.closePanel();
    fixture.detectChanges();
    expect(emitted).toEqual([{ tags: ['wor'] }]);
    expect(input.value).toBe('');
  });

  it('commits typed tag text when the editor closes with no blur', () => {
    const fixture = setUp(item({ tags: ['time'] }));
    const emitted = edits(fixture);
    const input = tagInput(fixture);
    input.value = 'Work';
    input.dispatchEvent(new Event('input'));
    fixture.destroy();
    expect(emitted).toEqual([{ tags: ['time', 'work'] }]);
  });

  it('refuses a duplicate tag, keeping what was typed and saying why', () => {
    const fixture = setUp(item({ tags: ['time'] }));
    const emitted = edits(fixture);
    typeTag(fixture, 'Time');
    expect(emitted).toEqual([]);
    expect(tagInput(fixture).value).toBe('Time');
    expect(el(fixture).querySelector('.duplicate-hint')?.textContent).toContain(
      '"time" is already a tag.',
    );
  });

  it('removes a tag through its chip button, named after the tag', () => {
    const fixture = setUp(item({ tags: ['time', 'work'] }));
    const emitted = edits(fixture);
    const remove = el(fixture).querySelector<HTMLButtonElement>(
      'button[aria-label="Remove tag time"]',
    )!;
    remove.click();
    expect(emitted).toEqual([{ tags: ['work'] }]);
  });

  it('toggles the favourite star with its pressed state', () => {
    const fixture = setUp(item());
    const emitted = edits(fixture);
    const star = el(fixture).querySelector('.favourite-button') as HTMLButtonElement;
    expect(star.getAttribute('aria-pressed')).toBe('false');
    star.click();
    expect(emitted).toEqual([{ favourite: true }]);
    fixture.componentRef.setInput('item', item({ favourite: true }));
    fixture.detectChanges();
    expect(star.getAttribute('aria-pressed')).toBe('true');
  });

  it('clears the refused tag text and the touched error when another item is selected', async () => {
    const fixture = setUp(item({ text: '', tags: ['time'] }));
    el(fixture).querySelector('textarea')!.dispatchEvent(new Event('blur'));
    typeTag(fixture, 'time');
    expect(el(fixture).querySelector('[role="alert"]')).not.toBeNull();

    fixture.componentRef.setInput('item', item({ id: 'i2', text: '', tags: [] }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el(fixture).querySelector('[role="alert"]')).toBeNull();
    expect(tagInput(fixture).value).toBe('');
    expect(el(fixture).querySelector('.duplicate-hint')?.textContent?.trim()).toBe('');
  });
});
