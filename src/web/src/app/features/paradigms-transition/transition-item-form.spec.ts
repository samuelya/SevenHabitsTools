import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TransitionItemForm } from './transition-item-form';
import { Script } from './transition.model';

function script(overrides: Partial<Script> = {}): Script {
  return {
    id: 's1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    text: 'Conflict means someone has to lose',
    source: 'family',
    effect: 'harms',
    decision: 'keep',
    ...overrides,
  };
}

/** `attached: true` puts the fixture in `document.body` before the first `detectChanges()` —
 * required for the focus-move tests below: `HTMLElement.focus()` on a still-detached element
 * silently no-ops in jsdom. */
function setUp(value: Script, options: { attached?: boolean } = {}) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-transition')],
  });
  const fixture = TestBed.createComponent(TransitionItemForm);
  if (options.attached) {
    document.body.appendChild(fixture.nativeElement);
  }
  fixture.componentRef.setInput('script', value);
  fixture.detectChanges();
  return fixture;
}

describe('TransitionItemForm', () => {
  it('renders the script text', () => {
    const fixture = setUp(script());

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Conflict means someone has to lose');
  });

  it('emits changed with the edited text', () => {
    const fixture = setUp(script());
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((value) => emitted.push(value));

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'New text';
    textarea.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([{ text: 'New text' }]);
  });

  it('hides the new-script and situation fields when the decision is keep', () => {
    const fixture = setUp(script({ decision: 'keep' }));

    expect(fixture.nativeElement.querySelectorAll('textarea')).toHaveLength(1);
  });

  it.each(['rewrite', 'stop'] as const)(
    'shows the new-script and situation fields when the decision is %s',
    (decision) => {
      const fixture = setUp(script({ decision }));

      expect(fixture.nativeElement.querySelectorAll('textarea')).toHaveLength(2);
      expect(fixture.nativeElement.querySelector('input[type="text"]')).not.toBeNull();
    },
  );

  it('shows a required error for the new-script field only after it is touched and left blank', () => {
    const fixture = setUp(script({ decision: 'stop' }));

    const newScriptTextarea = fixture.nativeElement.querySelectorAll(
      'textarea',
    )[1] as HTMLTextAreaElement;
    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();

    newScriptTextarea.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error')).not.toBeNull();
  });

  it('does not carry a touched error over to a different script once the selection changes', () => {
    const fixture = setUp(script({ id: 's1', decision: 'stop' }));

    const newScriptTextarea = fixture.nativeElement.querySelectorAll(
      'textarea',
    )[1] as HTMLTextAreaElement;
    newScriptTextarea.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.field-error')).not.toBeNull();

    fixture.componentRef.setInput('script', script({ id: 's2', decision: 'stop' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();
  });

  it('emits deleted when the delete button is clicked', () => {
    const fixture = setUp(script());
    const emitted: void[] = [];
    fixture.componentInstance.deleted.subscribe(() => emitted.push(undefined));

    (fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(1);
  });

  it('shows the decision hint under the decision toggle group', () => {
    const fixture = setUp(script());

    expect(fixture.nativeElement.querySelector('.decision-hint')?.textContent).toContain(
      'write the new script',
    );
  });

  it('focuses the script field on open (#187)', async () => {
    const fixture = setUp(script(), { attached: true });
    // The focus call is a `queueMicrotask` (see `transition-item-form.ts`'s doc comment on why),
    // so it hasn't run yet at the point `setUp()` returns.
    await Promise.resolve();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('textarea'));

    fixture.nativeElement.remove();
  });

  it('moves focus to the script field again when switching to a different script while the form stays open', async () => {
    const fixture = setUp(script({ id: 's1' }), { attached: true });
    await Promise.resolve();
    (fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement).focus();

    fixture.componentRef.setInput('script', script({ id: 's2', text: 'A different script' }));
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('textarea'));

    fixture.nativeElement.remove();
  });

  it('moves focus to the new-script field once choosing Rewrite or Stop reveals it (#187)', async () => {
    const fixture = setUp(script({ decision: 'keep' }));
    document.body.appendChild(fixture.nativeElement);
    // Flushes the id-change effect's own queued focus-the-script-field microtask (same id here,
    // so it only ran once, on construction) before it can fire *after* this test's own focus
    // move below and steal it back.
    await Promise.resolve();

    fixture.componentRef.setInput('script', script({ decision: 'stop' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const newScriptField = fixture.nativeElement.querySelectorAll('textarea')[1];
    expect(document.activeElement).toBe(newScriptField);

    fixture.nativeElement.remove();
  });
});
