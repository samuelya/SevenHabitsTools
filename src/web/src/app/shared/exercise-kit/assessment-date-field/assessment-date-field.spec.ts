import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentDateField } from './assessment-date-field';

@Component({
  imports: [AssessmentDateField],
  template: `
    <app-assessment-date-field
      [date]="date()"
      label="Date"
      [max]="max()"
      [refusedEdits]="refused()"
      (dateChanged)="emitted.push($event)"
    />
  `,
})
class HostComponent {
  readonly date = signal('2026-09-25');
  readonly max = signal<string | null>('2026-09-30');
  readonly refused = signal(0);
  readonly emitted: string[] = [];
}

describe('AssessmentDateField (issue #226)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let field: HTMLInputElement;

  /** One segment edit, as Chromium reports it: `input` and `change` while the field has focus. */
  function type(value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
  }

  function leave(): void {
    field.dispatchEvent(new Event('blur'));
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    field = fixture.nativeElement.querySelector('input');
    field.focus();
  });

  it('is a labelled, required native date input showing the stored date', () => {
    expect(field.type).toBe('date');
    expect(field.required).toBe(true);
    expect(field.value).toBe('2026-09-25');
    expect(fixture.nativeElement.querySelector('mat-label').textContent).toContain('Date');
  });

  it('emits a real calendar date when the user leaves the field', () => {
    type('2026-09-01');
    leave();
    expect(fixture.componentInstance.emitted).toEqual(['2026-09-01']);
  });

  it('emits only the final date of a segment-by-segment edit, not the ones in between', () => {
    // 31 Aug typed over 25 Sep, one segment at a time: day, then month.
    type('2026-09-03');
    type('2026-09-30');
    type('2026-08-30');
    type('2026-08-31');
    expect(fixture.componentInstance.emitted).toEqual([]);

    leave();
    expect(fixture.componentInstance.emitted).toEqual(['2026-08-31']);
  });

  it('commits on Enter', () => {
    type('2026-09-01');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(fixture.componentInstance.emitted).toEqual(['2026-09-01']);
  });

  it('commits a change made while the field is not focused (a picker)', () => {
    field.blur();
    field.value = '2026-09-02';
    field.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.emitted).toEqual(['2026-09-02']);
  });

  it('caps the date at max and never emits a later one', () => {
    expect(field.getAttribute('max')).toBe('2026-09-30');

    type('2062-09-25');
    leave();
    expect(fixture.componentInstance.emitted).toEqual([]);
    expect(field.value).toBe('2026-09-25');
  });

  it('does not put an invalid stored date back, and accepts a real one over it', async () => {
    fixture.componentInstance.date.set('2026-13-01');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(field.value).toBe('');

    type('');
    leave();
    expect(field.value).toBe('');

    type('2026-09-01');
    leave();
    expect(fixture.componentInstance.emitted).toEqual(['2026-09-01']);
  });

  it('never emits a cleared value, and puts the stored date back on blur', () => {
    type('');
    leave();
    expect(fixture.componentInstance.emitted).toEqual([]);
    expect(field.value).toBe('2026-09-25');
  });

  it('puts the stored date back when the page reports the edit refused', async () => {
    type('2026-09-01');
    expect(field.value).toBe('2026-09-01');

    fixture.componentInstance.refused.set(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(field.value).toBe('2026-09-25');
  });

  it('shows a date the page stored', async () => {
    type('2026-09-01');
    fixture.componentInstance.date.set('2026-09-01');
    fixture.detectChanges();
    await fixture.whenStable();
    leave();

    expect(field.value).toBe('2026-09-01');
  });
});
