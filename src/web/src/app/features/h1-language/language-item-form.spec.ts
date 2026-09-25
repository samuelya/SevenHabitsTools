import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { LanguageItemForm } from './language-item-form';
import { Phrase, PhraseFields } from './language.model';

function phrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    text: 'I have to stay late',
    kind: 'reactive',
    ...overrides,
  };
}

function setUp(value: Phrase) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('h1-language'),
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(LanguageItemForm);
  fixture.componentRef.setInput('phrase', value);
  fixture.detectChanges();
  const emitted: Partial<PhraseFields>[] = [];
  fixture.componentInstance.changed.subscribe((fields) => emitted.push(fields));
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

function type(element: HTMLElement, selector: string, value: string): void {
  const field = element.querySelector(selector) as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

describe('LanguageItemForm', () => {
  it('shows both kinds, each with its example words', () => {
    const { element } = setUp(phrase());

    const options = [...element.querySelectorAll('.kind-option')].map((o) => o.textContent);
    expect(options).toHaveLength(2);
    expect(options[0]).toContain('Giving away the choice');
    expect(options[0]).toContain('I have to, they made me, if only');
    expect(options[1]).toContain('Owning the choice');
    expect(options[1]).toContain('I choose, I will');
  });

  it('labels, prompts and placeholders every free-text field', () => {
    const { element } = setUp(phrase());

    expect(element.textContent).toContain('What did you say or think, word for word?');
    expect(element.querySelectorAll('textarea')[0].placeholder).toBe(
      'e.g. I have to stay late again, they never plan anything.',
    );
    expect(element.querySelectorAll('textarea')[1].placeholder).toBe(
      "e.g. I'll stay till six tonight, and tomorrow I'll ask for the plan earlier.",
    );
    expect((element.querySelector('input[type="text"]') as HTMLInputElement).placeholder).toBe(
      'e.g. Team call, 5 pm',
    );
  });

  it('shows "Your rewrite" for a phrase giving the choice away only', () => {
    const { fixture, element } = setUp(phrase());
    expect(element.textContent).toContain('Your rewrite');

    fixture.componentRef.setInput('phrase', phrase({ kind: 'proactive' }));
    fixture.detectChanges();
    expect(element.textContent).not.toContain('Your rewrite');
    expect(element.querySelectorAll('textarea')).toHaveLength(1);
  });

  it('emits each typed field and the picked kind', () => {
    const { element, emitted } = setUp(phrase());

    const [text, reframe] = [...element.querySelectorAll('textarea')];
    text.value = 'They made me';
    text.dispatchEvent(new Event('input'));
    reframe.value = 'I chose';
    reframe.dispatchEvent(new Event('input'));
    type(element, 'input[type="text"]', 'Kitchen');
    (element.querySelectorAll('.kind-option input')[1] as HTMLInputElement).click();

    expect(emitted).toContainEqual({ text: 'They made me' });
    expect(emitted).toContainEqual({ reframe: 'I chose' });
    expect(emitted).toContainEqual({ context: 'Kitchen' });
    expect(emitted).toContainEqual({ kind: 'proactive' });
  });

  it('shows the required messages after blur, and resets them for another phrase', () => {
    const { fixture, element } = setUp(phrase({ text: '' }));
    const [text, reframe] = [...element.querySelectorAll('textarea')];

    text.dispatchEvent(new Event('blur'));
    reframe.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(element.querySelector('#text-error')?.textContent).toContain('Write the phrase first.');
    expect(element.querySelector('#reframe-error')?.textContent).toContain(
      'Rewrite it as a choice.',
    );

    // The same phrase saved again keeps them; another phrase starts clean.
    fixture.componentRef.setInput('phrase', phrase({ text: '', updatedAt: 'later' }));
    fixture.detectChanges();
    expect(element.querySelector('#text-error')).not.toBeNull();

    fixture.componentRef.setInput('phrase', phrase({ id: 'p2', text: '' }));
    fixture.detectChanges();
    expect(element.querySelector('#text-error')).toBeNull();
    expect(element.querySelector('#reframe-error')).toBeNull();
  });

  it('shows the other phrase text when the input changes', () => {
    const { fixture, element } = setUp(phrase());

    fixture.componentRef.setInput('phrase', phrase({ id: 'p2', text: 'If only', context: 'Bus' }));
    fixture.detectChanges();
    expect((element.querySelector('textarea') as HTMLTextAreaElement).value).toBe('If only');
    expect((element.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Bus');
  });
});
