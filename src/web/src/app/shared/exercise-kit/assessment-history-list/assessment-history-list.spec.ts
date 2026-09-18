import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
// Side-effect only: this component's title renders through `AppDatePipe`, which resolves
// `settings.numerals` via `featureStore` — see `done-toggle.spec.ts`'s own import.
import '../../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { AssessmentHistoryList } from './assessment-history-list';

@Component({
  imports: [AssessmentHistoryList],
  template: `
    <app-assessment-history-list
      [items]="items"
      [selectedId]="selectedId"
      emptyMessage="No history yet."
      (itemSelected)="selected = $event"
    />
  `,
})
class HostComponent {
  items: { id: string; date: string; subtitle?: string }[] = [];
  selectedId: string | null = null;
  selected: string | null = null;
}

describe('AssessmentHistoryList', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(HostComponent);
  });

  it('shows the empty message with no items', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty').textContent).toContain('No history yet.');
  });

  it('renders each item date and subtitle in the given order', () => {
    fixture.componentInstance.items = [
      { id: 'a1', date: '2026-09-18', subtitle: 'Balanced' },
      { id: 'a2', date: '2026-09-01', subtitle: 'Over-used' },
    ];
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('2026');
    expect(buttons[0].textContent).toContain('Balanced');
    expect(buttons[1].textContent).toContain('Over-used');
  });

  it('marks the selected item pressed', () => {
    fixture.componentInstance.items = [{ id: 'a1', date: '2026-09-18' }];
    fixture.componentInstance.selectedId = 'a1';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('emits itemSelected when a row is clicked', () => {
    fixture.componentInstance.items = [{ id: 'a1', date: '2026-09-18' }];
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(fixture.componentInstance.selected).toBe('a1');
  });
});
