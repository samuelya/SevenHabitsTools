import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import '../../features/settings/settings.model';
import { RoleEdit } from '../../shared/roles/roles.logic';
import { Role } from '../../shared/roles/roles.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { RolesItemForm } from './roles-item-form';

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'r1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    name: 'Dad',
    order: 1,
    ...overrides,
  };
}

function setUp(value: Role, inputs: Record<string, unknown> = {}): ComponentFixture<RolesItemForm> {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(RolesItemForm);
  fixture.componentRef.setInput('role', value);
  for (const [name, input] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, input);
  }
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<RolesItemForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function edits(fixture: ComponentFixture<RolesItemForm>): RoleEdit[] {
  const emitted: RoleEdit[] = [];
  fixture.componentInstance.changed.subscribe((edit) => emitted.push(edit));
  return emitted;
}

describe('RolesItemForm', () => {
  it('gives every free-text field its label, prompt and the guide example as placeholder', () => {
    const fixture = setUp(role());
    const text = el(fixture).textContent ?? '';
    expect(text).toContain('What part do you play? One or two words.');
    expect(text).toContain('One line on what this role means to you.');
    expect(text).toContain("Is this the picture you want? If not, what's missing?");
    const placeholders = [...el(fixture).querySelectorAll('input[type="text"], textarea')].map(
      (field) => field.getAttribute('placeholder'),
    );
    expect(placeholders).toEqual([
      'e.g. Dad',
      'e.g. Being around, not just providing.',
      "e.g. Not yet. I'm there for homework, not for fun.",
    ]);
  });

  it('emits name, description and note as typed', () => {
    const fixture = setUp(role());
    const emitted = edits(fixture);
    const [name, description] =
      el(fixture).querySelectorAll<HTMLInputElement>('input[type="text"]');
    name.value = 'Mum';
    name.dispatchEvent(new Event('input'));
    description.value = 'Around.';
    description.dispatchEvent(new Event('input'));
    const note = el(fixture).querySelector('textarea')!;
    note.value = 'Mostly.';
    note.dispatchEvent(new Event('input'));
    expect(emitted).toEqual([{ name: 'Mum' }, { description: 'Around.' }, { note: 'Mostly.' }]);
  });

  it('says the name is required once the field is left empty', () => {
    const fixture = setUp(role({ name: '' }));
    const name = el(fixture).querySelector<HTMLInputElement>('input[type="text"]')!;
    name.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'Name the role first.',
    );
  });

  it('keeps the required error while a saved name is cleared, even though the role keeps it', () => {
    const fixture = setUp(role({ name: 'Dad' }));
    const emitted = edits(fixture);
    const name = el(fixture).querySelector<HTMLInputElement>('input[type="text"]')!;
    name.value = '   ';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // The page's `editRole()` ignores the blank name, so `role` still says "Dad".
    expect(emitted).toEqual([{ name: '   ' }]);
    expect(el(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'Name the role first.',
    );
  });

  it('rates with a labelled radio group showing the value', () => {
    const fixture = setUp(role({ satisfaction: 3 }));
    const group = el(fixture).querySelector('mat-radio-group')!;
    expect(group.getAttribute('aria-label')).toBe("How it's going: 3 of 5");
    expect(el(fixture).querySelectorAll('mat-radio-button')).toHaveLength(5);
    expect(el(fixture).querySelector('.rating-value')?.textContent).toContain('3 of 5');

    const emitted = edits(fixture);
    const four = el(fixture).querySelectorAll<HTMLInputElement>('mat-radio-button input')[3];
    four.click();
    expect(emitted).toEqual([{ satisfaction: 4 }]);
  });

  it('names every colour, and "None" clears it', () => {
    const fixture = setUp(role({ color: 'blue' }));
    const chips = [...el(fixture).querySelectorAll('mat-chip-option')];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
      'None',
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Teal',
      'Blue',
      'Purple',
      'Grey',
    ]);
    const emitted = edits(fixture);
    (chips[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(emitted).toEqual([{ color: null }]);
  });

  it('emits nothing when the selected colour is tapped again, None included, and keeps it selected', () => {
    for (const [color, index] of [
      [undefined, 0],
      ['blue', 6],
    ] as const) {
      const fixture = setUp(role({ color }));
      const emitted = edits(fixture);
      const chip = el(fixture).querySelectorAll('mat-chip-option')[index];
      (chip.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(emitted).toEqual([]);
      expect(chip.querySelector('[role="option"]')?.getAttribute('aria-selected')).toBe('true');
      TestBed.resetTestingModule();
    }
  });

  it('shows the built-in by label, without name field, archive or delete', () => {
    const fixture = setUp(role({ name: undefined, key: 'renewal' }), {
      builtInLabel: 'Sharpen the Saw',
    });
    const text = el(fixture).textContent ?? '';
    expect(text).toContain('Sharpen the Saw');
    expect(text).toContain('This role comes with the app.');
    expect(el(fixture).querySelector('input[required]')).toBeNull();
    expect(el(fixture).querySelector('.archive')).toBeNull();
    expect(el(fixture).querySelector('.delete-button')).toBeNull();
    expect(el(fixture).querySelector('.move-up')).not.toBeNull();
  });

  it('disables moving and archiving an unsaved draft, and moves at the edges', () => {
    const draft = setUp(role(), { saved: false, canMoveUp: true, canMoveDown: true });
    expect((el(draft).querySelector('.move-up') as HTMLButtonElement).disabled).toBe(true);
    expect((el(draft).querySelector('.archive') as HTMLButtonElement).disabled).toBe(true);
    TestBed.resetTestingModule();

    const fixture = setUp(role({ archived: true }), { canMoveUp: false, canMoveDown: true });
    expect((el(fixture).querySelector('.move-up') as HTMLButtonElement).disabled).toBe(true);
    const moved: string[] = [];
    fixture.componentInstance.moved.subscribe((direction) => moved.push(direction));
    (el(fixture).querySelector('.move-down') as HTMLButtonElement).click();
    expect(moved).toEqual(['down']);
    const archived: boolean[] = [];
    fixture.componentInstance.archivedChange.subscribe((value) => archived.push(value));
    (el(fixture).querySelector('.unarchive') as HTMLButtonElement).click();
    expect(archived).toEqual([false]);
  });
});
