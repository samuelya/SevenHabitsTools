import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentDateField } from './assessment-date-field';

@Component({
  imports: [AssessmentDateField],
  template: `
    <app-assessment-date-field
      [date]="date()"
      label="Date"
      [refusedEdits]="refused()"
      (dateChanged)="emitted.push($event)"
    />
  `,
})
class HostComponent {
  readonly date = signal('2026-09-25');
  readonly refused = signal(0);
  readonly emitted: string[] = [];
}

describe('AssessmentDateField (issue #226)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let field: HTMLInputElement;

  function type(value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    field = fixture.nativeElement.querySelector('input');
  });

  it('is a labelled, required native date input showing the stored date', () => {
    expect(field.type).toBe('date');
    expect(field.required).toBe(true);
    expect(field.value).toBe('2026-09-25');
    expect(fixture.nativeElement.querySelector('mat-label').textContent).toContain('Date');
  });

  it('emits a real calendar date', () => {
    type('2026-09-01');
    expect(fixture.componentInstance.emitted).toEqual(['2026-09-01']);
  });

  it('never emits a cleared value, and puts the stored date back on blur', () => {
    type('');
    expect(fixture.componentInstance.emitted).toEqual([]);

    field.dispatchEvent(new Event('blur'));
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
    field.dispatchEvent(new Event('blur'));

    expect(field.value).toBe('2026-09-01');
  });
});
