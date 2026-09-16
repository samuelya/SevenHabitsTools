import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExercisePromptCard } from './exercise-prompt-card';

function setUp(inputs: {
  title: string;
  prompt: string;
  chapterReference?: string;
  whyItMatters?: string;
}) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(ExercisePromptCard);
  fixture.componentRef.setInput('title', inputs.title);
  fixture.componentRef.setInput('prompt', inputs.prompt);
  fixture.componentRef.setInput('chapterReference', inputs.chapterReference ?? null);
  fixture.componentRef.setInput('whyItMatters', inputs.whyItMatters ?? null);
  fixture.detectChanges();
  return fixture;
}

describe('ExercisePromptCard', () => {
  it('renders the title and prompt', () => {
    const fixture = setUp({ title: 'Circle of Influence', prompt: 'List what you can control.' });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Circle of Influence');
    expect(text).toContain('List what you can control.');
  });

  it('renders the chapter reference when given', () => {
    const fixture = setUp({
      title: 'Circle of Influence',
      prompt: 'List what you can control.',
      chapterReference: 'Habit 1',
    });

    expect(fixture.nativeElement.textContent as string).toContain('Habit 1');
  });

  it('omits the "why this matters" expander when not given', () => {
    const fixture = setUp({ title: 'Circle of Influence', prompt: 'List what you can control.' });

    expect(fixture.nativeElement.querySelector('mat-expansion-panel')).toBeNull();
  });

  it('shows the "why this matters" expander with its text when given', () => {
    const fixture = setUp({
      title: 'Circle of Influence',
      prompt: 'List what you can control.',
      whyItMatters: 'Focusing here builds proactive habits.',
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Why this matters');
    expect(text).toContain('Focusing here builds proactive habits.');
  });
});
