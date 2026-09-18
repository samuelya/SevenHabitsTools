import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExercisePromptCard } from './exercise-prompt-card';

function setUp(inputs: {
  prompt: string;
  chapterReference?: string;
  whyItMatters?: string;
  expanded?: boolean;
}) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(ExercisePromptCard);
  fixture.componentRef.setInput('prompt', inputs.prompt);
  fixture.componentRef.setInput('chapterReference', inputs.chapterReference ?? null);
  fixture.componentRef.setInput('whyItMatters', inputs.whyItMatters ?? null);
  if (inputs.expanded !== undefined) {
    fixture.componentRef.setInput('expanded', inputs.expanded);
  }
  fixture.detectChanges();
  return fixture;
}

function toggleButton(fixture: ReturnType<typeof setUp>): HTMLButtonElement {
  return (fixture.nativeElement as HTMLElement).querySelector('.toggle') as HTMLButtonElement;
}

describe('ExercisePromptCard', () => {
  it('is expanded by default, showing the prompt', () => {
    const fixture = setUp({ prompt: 'List what you can control.' });

    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'List what you can control.',
    );
  });

  it('renders the chapter reference when given and expanded', () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      chapterReference: 'Habit 1',
    });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Habit 1');
  });

  it('shows the "why this matters" heading and text when given and expanded', () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      whyItMatters: 'Focusing here builds proactive habits.',
    });

    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('Why this matters');
    expect(text).toContain('Focusing here builds proactive habits.');
  });

  it('omits the "why this matters" text entirely when not given', () => {
    const fixture = setUp({ prompt: 'List what you can control.' });

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Why this matters');
  });

  it('hides the subtitle, prompt and "why this matters" text entirely when collapsed', () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      chapterReference: 'Habit 1',
      whyItMatters: 'Focusing here builds proactive habits.',
      expanded: false,
    });

    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(text).not.toContain('List what you can control.');
    expect(text).not.toContain('Habit 1');
    expect(text).not.toContain('Why this matters');
    expect(text).toContain('About this exercise');
  });

  it('expands and collapses when the toggle is clicked, with no page binding at all', () => {
    const fixture = setUp({ prompt: 'List what you can control.' });

    toggleButton(fixture).click();
    fixture.detectChanges();
    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('false');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'List what you can control.',
    );

    toggleButton(fixture).click();
    fixture.detectChanges();
    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'List what you can control.',
    );
  });

  it('emits expandedChange when toggled, for a page that binds [(expanded)]', () => {
    @Component({
      selector: 'app-host',
      imports: [ExercisePromptCard],
      template: `<app-exercise-prompt-card prompt="Prompt" [(expanded)]="expanded" />`,
    })
    class HostComponent {
      readonly expanded = signal(true);
    }
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    (host.querySelector('.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.expanded()).toBe(false);
  });
});
