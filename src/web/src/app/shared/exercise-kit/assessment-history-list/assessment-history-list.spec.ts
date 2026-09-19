import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
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
      [deletable]="deletable"
      (itemSelected)="selected = $event"
      (deleteRequested)="deleteRequested = $event"
    />
  `,
})
class HostComponent {
  items: { id: string; date: string; subtitle?: string }[] = [];
  selectedId: string | null = null;
  selected: string | null = null;
  deletable = false;
  deleteRequested: string | null = null;
}

function deleteButtons(fixture: { nativeElement: HTMLElement }): HTMLButtonElement[] {
  return [
    ...fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.assessment-history-list__delete',
    ),
  ];
}

describe('AssessmentHistoryList', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
    });
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

  it('renders no bin button when deletable is left at its default (issue #203)', () => {
    fixture.componentInstance.items = [{ id: 'a1', date: '2026-09-18' }];
    fixture.detectChanges();

    expect(deleteButtons(fixture)).toHaveLength(0);
  });

  it('renders a bin button per row, named after the row date, once deletable is set', () => {
    fixture.componentInstance.items = [{ id: 'a1', date: '2026-09-18' }];
    fixture.componentInstance.deletable = true;
    fixture.detectChanges();

    const buttons = deleteButtons(fixture);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toContain('2026');
  });

  it('emits deleteRequested with the item id when its bin button is clicked', () => {
    fixture.componentInstance.items = [{ id: 'a1', date: '2026-09-18' }];
    fixture.componentInstance.deletable = true;
    fixture.detectChanges();

    deleteButtons(fixture)[0].click();

    expect(fixture.componentInstance.deleteRequested).toBe('a1');
  });
});
