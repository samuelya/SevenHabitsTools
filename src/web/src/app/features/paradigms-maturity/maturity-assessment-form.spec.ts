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
  it('renders one row per area, showing the built-in label when unnamed', () => {
    const fixture = setUp(
      assessment({ areas: [area({ id: 'a1', key: 'work' }), area({ id: 'a2', key: 'family' })] }),
    );
    const rows = fixture.nativeElement.querySelectorAll('.area-row');
    expect(rows).toHaveLength(2);
    expect((rows[0].querySelector('input') as HTMLInputElement).value).toBe('Work');
  });

  it('shows a custom or renamed name instead of the built-in label', () => {
    const fixture = setUp(assessment({ areas: [area({ key: 'work', name: 'Day job' })] }));
    const input = fixture.nativeElement.querySelector('.area-row input') as HTMLInputElement;
    expect(input.value).toBe('Day job');
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
