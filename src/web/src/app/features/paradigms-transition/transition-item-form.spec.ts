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

function setUp(value: Script) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('paradigms-transition')],
  });
  const fixture = TestBed.createComponent(TransitionItemForm);
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

  it('emits deleted when the delete button is clicked', () => {
    const fixture = setUp(script());
    const emitted: void[] = [];
    fixture.componentInstance.deleted.subscribe(() => emitted.push(undefined));

    (fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement).click();

    expect(emitted).toHaveLength(1);
  });
});
