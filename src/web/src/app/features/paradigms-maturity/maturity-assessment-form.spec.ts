import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { MaturityAssessmentForm } from './maturity-assessment-form';
import { MaturityArea, MaturityAssessment } from './maturity.model';

const LABELS = { work: 'Work', family: 'Family', money: 'Money' };

function area(overrides: Partial<MaturityArea> = {}): MaturityArea {
  return { id: 'ar1', key: 'work', ...overrides };
}

function assessment(overrides: Partial<MaturityAssessment> = {}): MaturityAssessment {
  return {
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-01',
    areas: [],
    ...overrides,
  };
}

function setUp(initial: MaturityAssessment) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-maturity')],
  });
  const fixture = TestBed.createComponent(MaturityAssessmentForm);
  fixture.componentRef.setInput('assessment', initial);
  fixture.componentRef.setInput('builtInLabels', LABELS);
  fixture.detectChanges();
  return fixture;
}

describe('MaturityAssessmentForm', () => {
  it('renders one row per area, showing the built-in label as a placeholder when unnamed', () => {
    const fixture = setUp(
      assessment({ areas: [area({ id: 'a1', key: 'work' }), area({ id: 'a2', key: 'family' })] }),
    );
    const rows = fixture.nativeElement.querySelectorAll('.area-row');
    expect(rows).toHaveLength(2);
    const input = rows[0].querySelector('input') as HTMLInputElement;
    // The placeholder, not the field's own value: seeding the value with the translated fallback
    // used to freeze it as literal text the moment the field was edited in any way (review finding
    // on #49/#50's PR).
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('Work');
  });

  it('shows a custom or renamed name instead of the built-in label, and the example placeholder (#230)', () => {
    const fixture = setUp(assessment({ areas: [area({ key: 'work', name: 'Day job' })] }));
    const input = fixture.nativeElement.querySelector('.area-row input') as HTMLInputElement;
    expect(input.value).toBe('Day job');
    expect(input.placeholder).toBe('e.g. Friendships');
  });

  it('gives the note and new-area fields an example placeholder (#230)', () => {
    const fixture = setUp(assessment({ areas: [area({ key: 'work' })] }));
    const element = fixture.nativeElement as HTMLElement;
    expect((element.querySelector('.area-note textarea') as HTMLTextAreaElement).placeholder).toBe(
      'e.g. I still wait for my manager to tell me what to focus on.',
    );
    expect((element.querySelector('.add-area-row input') as HTMLInputElement).placeholder).toBe(
      'e.g. Friendships',
    );
  });

  it('emits the renamed area, keeping its key', () => {
    const fixture = setUp(assessment({ areas: [area({ id: 'a1', key: 'work' })] }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
    const input = fixture.nativeElement.querySelector('.area-row input') as HTMLInputElement;

    input.value = 'Day job';
    input.dispatchEvent(new Event('input'));

    const areas = (emitted[0] as { areas: MaturityArea[] }).areas;
    expect(areas[0]).toMatchObject({ key: 'work', name: 'Day job' });
  });

  it('never captures the translated built-in label as a stored name from an untouched field', () => {
    // Regression test: the field's `[value]` used to be the translated display fallback, so any
    // edit anywhere in the field committed that language's label text as a literal `name`.
    const fixture = setUp(assessment({ areas: [area({ id: 'a1', key: 'work' })] }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
    const input = fixture.nativeElement.querySelector('.area-row input') as HTMLInputElement;

    // Typing a single character into the (empty, placeholder-only) field.
    input.value = 'X';
    input.dispatchEvent(new Event('input'));

    const areas = (emitted[0] as { areas: MaturityArea[] }).areas;
    expect(areas[0].name).toBe('X');
  });

  it('clears a custom name back to the built-in placeholder instead of freezing on blank', () => {
    const fixture = setUp(
      assessment({ areas: [area({ id: 'a1', key: 'work', name: 'Day job' })] }),
    );
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
    const input = fixture.nativeElement.querySelector('.area-row input') as HTMLInputElement;

    input.value = '';
    input.dispatchEvent(new Event('input'));

    const areas = (emitted[0] as { areas: MaturityArea[] }).areas;
    expect(areas[0].name).toBeUndefined();
  });

  it('emits the selected level for the matching area', () => {
    const fixture = setUp(assessment({ areas: [area({ id: 'a1' })] }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));

    const radios = fixture.nativeElement.querySelectorAll(
      '.level-option input[type="radio"]',
    ) as NodeListOf<HTMLInputElement>;
    radios[1].click();
    fixture.detectChanges();

    const areas = (emitted[emitted.length - 1] as { areas: MaturityArea[] }).areas;
    expect(areas[0].level).toBe(2);
  });

  it('starts with no level selected', () => {
    const fixture = setUp(assessment({ areas: [area({ id: 'a1', level: undefined })] }));
    const checked = fixture.nativeElement.querySelectorAll('input[type="radio"]:checked');
    expect(checked).toHaveLength(0);
  });

  it('emits the edited note for the matching area', () => {
    const fixture = setUp(assessment({ areas: [area({ id: 'a1' })] }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'Feeling steadier lately';
    textarea.dispatchEvent(new Event('input'));

    const areas = (emitted[0] as { areas: MaturityArea[] }).areas;
    expect(areas[0].note).toBe('Feeling steadier lately');
  });

  it('removes the matching area', () => {
    const fixture = setUp(
      assessment({ areas: [area({ id: 'a1' }), area({ id: 'a2', key: 'family' })] }),
    );
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));

    (fixture.nativeElement.querySelector('.remove-area') as HTMLButtonElement).click();

    const areas = (emitted[0] as { areas: MaturityArea[] }).areas;
    expect(areas).toHaveLength(1);
    expect(areas[0].id).toBe('a2');
  });

  it('adds a custom area and clears the draft name', () => {
    const fixture = setUp(assessment({ areas: [] }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));
    const host = fixture.nativeElement as HTMLElement;

    const nameInput = host.querySelector('.add-area-row input') as HTMLInputElement;
    nameInput.value = 'Volunteering';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (host.querySelector('.add-area-row button') as HTMLButtonElement).click();

    const areas = (emitted[0] as { areas: MaturityArea[] }).areas;
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ name: 'Volunteering' });
  });

  it('does not add an area with a blank name', () => {
    const fixture = setUp(assessment({ areas: [] }));
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((event) => emitted.push(event));

    (fixture.nativeElement.querySelector('.add-area-row button') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(0);
  });
});
