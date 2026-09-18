import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
// Side-effect only: the "Shared <date>" hint renders through `AppDatePipe`, which resolves
// `settings.numerals` via `featureStore` — see `transition-page.spec.ts`'s own import for the
// same reason.
import '../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TeachItemForm } from './teach-item-form';
import { TeachEntryFields } from './teach.model';

function draft(overrides: Partial<TeachEntryFields> = {}): TeachEntryFields {
  return { chapter: 'h1', keyIdea: '', plannedAt: '2026-01-12', status: 'planned', ...overrides };
}

function setUp(value: TeachEntryFields, sharedAt: string | null = null) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-teach')],
  });
  const fixture = TestBed.createComponent(TeachItemForm);
  fixture.componentRef.setInput('entry', value);
  fixture.componentRef.setInput('sharedAt', sharedAt);
  fixture.detectChanges();
  return fixture;
}

describe('TeachItemForm', () => {
  it('renders the key idea', () => {
    const fixture = setUp(draft({ keyIdea: 'Choose your response' }));

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Choose your response');
  });

  it('emits changed with the edited key idea', () => {
    const fixture = setUp(draft());
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((value) => emitted.push(value));

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Choose your response';
    textarea.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([{ keyIdea: 'Choose your response' }]);
  });

  it('shows a required error only once the key idea field has been touched and is empty', () => {
    const fixture = setUp(draft());
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();

    textarea.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error')).not.toBeNull();
  });

  it('emits changed with the chosen status', () => {
    const fixture = setUp(draft());
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((value) => emitted.push(value));

    // planned, shared, skipped — same order as `TEACH_STATUSES`.
    const toggles = fixture.nativeElement.querySelectorAll(
      'mat-button-toggle-group button',
    ) as NodeListOf<HTMLButtonElement>;
    toggles[1].click();

    expect(emitted).toEqual([{ status: 'shared' }]);
  });

  it('shows the shared date once the entry has one', () => {
    const fixture = setUp(draft({ status: 'shared' }), '2026-01-05');

    expect(fixture.nativeElement.textContent).toContain('Shared');
  });

  it('shows no shared date before the entry has been shared', () => {
    const fixture = setUp(draft());

    expect(fixture.nativeElement.querySelector('.shared-at-hint')).toBeNull();
  });

  it('resets the touched state when the chapter changes', () => {
    const fixture = setUp(draft());
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.field-error')).not.toBeNull();

    fixture.componentRef.setInput('entry', draft({ chapter: 'h2' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();
  });
});
