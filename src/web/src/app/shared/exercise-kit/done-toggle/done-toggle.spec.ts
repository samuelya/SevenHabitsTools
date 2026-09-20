import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import '../../../features/settings/settings.model';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { DoneChecklistItem, DoneToggle } from './done-toggle';

function setUp(
  done: boolean,
  completedAt: string | null = null,
  disabled = false,
  disabledHint: string | null = null,
  checklist: readonly DoneChecklistItem[] | null = null,
) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(DoneToggle);
  fixture.componentRef.setInput('done', done);
  fixture.componentRef.setInput('completedAt', completedAt);
  fixture.componentRef.setInput('disabled', disabled);
  fixture.componentRef.setInput('disabledHint', disabledHint);
  fixture.componentRef.setInput('checklist', checklist);
  fixture.detectChanges();
  return fixture;
}

describe('DoneToggle', () => {
  it('shows "Mark done" when not done', () => {
    const fixture = setUp(false);

    expect(fixture.nativeElement.textContent).toContain('Mark done');
  });

  it('shows "Reopen" and the completed time when done', () => {
    const fixture = setUp(true, '2026-01-02T10:00:00.000Z');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Reopen');
    expect(text).toContain('Completed');
  });

  it('emits toggled when clicked', () => {
    const fixture = setUp(false);
    const emitted: void[] = [];
    fixture.componentInstance.toggled.subscribe(() => emitted.push(undefined));

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(1);
  });

  it('disables "Mark done" when disabled is set', () => {
    const fixture = setUp(false, null, true);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('never disables "Reopen", even when disabled is set', () => {
    const fixture = setUp(true, '2026-01-02T10:00:00.000Z', true);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('renders the disabled hint and links it to the button, when disabled and a hint is given', () => {
    const fixture = setUp(false, null, true, 'Complete at least one item first.');
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('button') as HTMLButtonElement;
    const hint = host.querySelector('.disabled-hint') as HTMLElement;

    expect(hint.textContent).toContain('Complete at least one item first.');
    expect(button.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('omits the hint when a hint is given but the button is not disabled', () => {
    const fixture = setUp(false, null, false, 'Complete at least one item first.');
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.disabled-hint')).toBeNull();
    expect(
      (host.querySelector('button') as HTMLButtonElement).getAttribute('aria-describedby'),
    ).toBeNull();
  });

  it('omits the hint when disabled but no hint is given', () => {
    const fixture = setUp(false, null, true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.disabled-hint')).toBeNull();
  });

  const checklist: readonly DoneChecklistItem[] = [
    { label: 'Write your first guess', met: true },
    { label: 'Rate the difficulty', met: false },
  ];

  it('renders the checklist under "To mark done:" while disabled, with a check for met items', () => {
    const fixture = setUp(false, null, true, null, checklist);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('To mark done:');
    const items = [...host.querySelectorAll('.done-checklist-list li')];
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('mat-icon')?.textContent).toBe('check_circle');
    expect(items[1].querySelector('mat-icon')?.textContent).toBe('radio_button_unchecked');
  });

  it('links the button to the checklist through aria-describedby', () => {
    const fixture = setUp(false, null, true, null, checklist);
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('button') as HTMLButtonElement;
    const list = host.querySelector('.done-checklist') as HTMLElement;

    expect(button.getAttribute('aria-describedby')).toBe(list.id);
  });

  it('omits the checklist once every item is met', () => {
    const fixture = setUp(false, null, true, null, [
      { label: 'Write your first guess', met: true },
      { label: 'Rate the difficulty', met: true },
    ]);

    expect((fixture.nativeElement as HTMLElement).querySelector('.done-checklist')).toBeNull();
  });

  it('omits the checklist once the exercise is done, even if items are still unmet', () => {
    const fixture = setUp(true, '2026-01-02T10:00:00.000Z', false, null, checklist);

    expect((fixture.nativeElement as HTMLElement).querySelector('.done-checklist')).toBeNull();
  });

  it('omits the checklist when the button is enabled (no checklist given, or all met)', () => {
    const fixture = setUp(false, null, false, null, checklist);

    expect((fixture.nativeElement as HTMLElement).querySelector('.done-checklist')).toBeNull();
  });
});
