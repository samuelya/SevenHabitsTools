import { Component, signal, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExerciseGuideContent } from '../exercise-guide/exercise-guide';
import { ExerciseGuideOpener } from '../exercise-guide/exercise-guide-opener';
import { ExercisePromptCard } from './exercise-prompt-card';

const GUIDE: ExerciseGuideContent = {
  inShort: 'In short.',
  howTo: ['Step one.'],
  examples: [],
  afterwards: 'Afterwards.',
};

function setUp(inputs: {
  prompt: string;
  chapterReference?: string;
  whyItMatters?: string;
  guide?: ExerciseGuideContent;
  gloss?: string;
  heading?: string;
  expanded?: boolean;
  collapsedByDefault?: boolean;
}) {
  const guideOpen = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('exercise-kit'),
      { provide: ExerciseGuideOpener, useValue: { open: guideOpen } },
    ],
  });
  const fixture = TestBed.createComponent(ExercisePromptCard);
  fixture.componentRef.setInput('prompt', inputs.prompt);
  fixture.componentRef.setInput('chapterReference', inputs.chapterReference ?? null);
  fixture.componentRef.setInput('whyItMatters', inputs.whyItMatters ?? null);
  fixture.componentRef.setInput('guide', inputs.guide ?? null);
  fixture.componentRef.setInput('gloss', inputs.gloss ?? null);
  fixture.componentRef.setInput('heading', inputs.heading ?? null);
  if (inputs.collapsedByDefault !== undefined) {
    fixture.componentRef.setInput('collapsedByDefault', inputs.collapsedByDefault);
  }
  if (inputs.expanded !== undefined) {
    fixture.componentRef.setInput('expanded', inputs.expanded);
  }
  fixture.detectChanges();
  return { fixture, guideOpen };
}

function toggleButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement {
  return fixture.nativeElement.querySelector('.toggle') as HTMLButtonElement;
}

function readMoreButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement | null {
  return fixture.nativeElement.querySelector('.read-more');
}

describe('ExercisePromptCard', () => {
  it('always shows the prompt, expanded or not', () => {
    const { fixture } = setUp({ prompt: 'List what you can control.', expanded: false });

    expect(fixture.nativeElement.textContent).toContain('List what you can control.');
  });

  it('shows the first-use gloss as an inline line under the prompt, even when collapsed (#218)', () => {
    const { fixture } = setUp({
      prompt: 'Name the scripts you inherited.',
      gloss: 'The pattern you learned at home.',
      expanded: false,
    });

    const gloss = fixture.nativeElement.querySelector('.visible-content .prompt-gloss');
    expect(gloss?.textContent?.trim()).toBe('The pattern you learned at home.');
    expect(fixture.nativeElement.querySelector('[matTooltip], [title]')).toBeNull();
  });

  it('shows the long title visibly when expanded, hidden from assistive tech (#218)', () => {
    const { fixture } = setUp({
      prompt: 'Name the scripts you inherited.',
      heading: 'Become a transition person',
      expanded: true,
    });

    const heading = fixture.nativeElement.querySelector('.visible-content .prompt-heading');
    expect(heading?.textContent?.trim()).toBe('Become a transition person');
    expect(heading?.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the long title while collapsed, so the primary action stays above the fold (#218)', () => {
    const { fixture } = setUp({
      prompt: 'Name the scripts you inherited.',
      heading: 'Become a transition person',
      expanded: false,
    });

    expect(fixture.nativeElement.querySelector('.prompt-heading')).toBeNull();
  });

  it('renders no gloss line when none is given', () => {
    const { fixture } = setUp({ prompt: 'List what you can control.' });

    expect(fixture.nativeElement.querySelector('.prompt-gloss')).toBeNull();
  });

  it('shows no Read more button when no guide is given', () => {
    const { fixture } = setUp({ prompt: 'List what you can control.' });

    expect(readMoreButton(fixture)).toBeNull();
  });

  it('shows the Read more button when a guide is given, and opens it through ExerciseGuideOpener', () => {
    const { fixture, guideOpen } = setUp({ prompt: 'List what you can control.', guide: GUIDE });

    const button = readMoreButton(fixture);
    expect(button).not.toBeNull();
    button?.click();

    expect(guideOpen).toHaveBeenCalledTimes(1);
    const [content, viewContainerRef] = guideOpen.mock.calls[0] as [
      ExerciseGuideContent,
      ViewContainerRef,
    ];
    expect(content).toBe(GUIDE);
    expect(viewContainerRef).toBeInstanceOf(ViewContainerRef);
  });

  it('re-emits a "Try this example" from the guide as exampleTried (#232)', () => {
    const guideOpen = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        { provide: ExerciseGuideOpener, useValue: { open: guideOpen } },
      ],
    });
    const fixture = TestBed.createComponent(ExercisePromptCard);
    fixture.componentRef.setInput('prompt', 'List what you can control.');
    fixture.componentRef.setInput('guide', GUIDE);
    fixture.detectChanges();
    const tried: unknown[] = [];
    fixture.componentInstance.exampleTried.subscribe((sample) => tried.push(sample));

    readMoreButton(fixture)?.click();
    const [, , options] = guideOpen.mock.calls[0] as [
      unknown,
      unknown,
      { onTryExample: (sample: object) => void },
    ];
    options.onTryExample({ text: 'x' });

    expect(tried).toEqual([{ text: 'x' }]);
  });

  it('does not open a second guide dialog on a double-tap before the first open resolves', async () => {
    // Regression test for a review finding: `openGuide()` had no re-entrancy guard and `open()` is
    // async, so a double-tap opened two dialogs and two focus traps.
    let resolveOpen!: () => void;
    const guideOpen = vi
      .fn()
      .mockReturnValue(new Promise<void>((resolve) => (resolveOpen = resolve)));
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        { provide: ExerciseGuideOpener, useValue: { open: guideOpen } },
      ],
    });
    const fixture = TestBed.createComponent(ExercisePromptCard);
    fixture.componentRef.setInput('prompt', 'List what you can control.');
    fixture.componentRef.setInput('guide', GUIDE);
    fixture.detectChanges();
    const button = readMoreButton(fixture);

    button?.click();
    button?.click();

    expect(guideOpen).toHaveBeenCalledTimes(1);

    resolveOpen();
    await fixture.whenStable();
    button?.click();

    expect(guideOpen).toHaveBeenCalledTimes(2);
  });

  it('is expanded by default, showing "why this matters" and the chapter reference', () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      chapterReference: 'Habit 1',
      whyItMatters: 'Focusing here builds proactive habits.',
    }).fixture;

    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('true');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Why this matters');
    expect(text).toContain('Focusing here builds proactive habits.');
    expect(text).toContain('From: Habit 1');
  });

  it('renders the chapter reference as the last line, not under "About this exercise"', () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      chapterReference: 'Habit 1',
      whyItMatters: 'Focusing here builds proactive habits.',
    }).fixture;

    const content = fixture.nativeElement.querySelector('.content') as HTMLElement;
    const children = [...content.children].map((el) => el.textContent);
    expect(children[children.length - 1]).toContain('From: Habit 1');
  });

  it('omits "why this matters" entirely when not given', () => {
    const fixture = setUp({ prompt: 'List what you can control.' }).fixture;

    expect(fixture.nativeElement.textContent).not.toContain('Why this matters');
  });

  it('hides "why this matters" and the chapter reference, but keeps the prompt, when collapsed', () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      chapterReference: 'Habit 1',
      whyItMatters: 'Focusing here builds proactive habits.',
      expanded: false,
    }).fixture;

    const text = fixture.nativeElement.textContent as string;
    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(text).toContain('List what you can control.');
    expect(text).not.toContain('Habit 1');
    expect(text).not.toContain('Why this matters');
    expect(text).toContain('About this exercise');
  });

  it('expands and collapses when the toggle is clicked, with no page binding at all', () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      whyItMatters: 'Why it matters.',
    }).fixture;

    toggleButton(fixture).click();
    fixture.detectChanges();
    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.textContent).not.toContain('Why it matters.');

    toggleButton(fixture).click();
    fixture.detectChanges();
    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Why it matters.');
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
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        { provide: ExerciseGuideOpener, useValue: { open: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    (host.querySelector('.toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.expanded()).toBe(false);
  });

  it('starts collapsed when collapsedByDefault is true from the start', async () => {
    const fixture = setUp({
      prompt: 'List what you can control.',
      whyItMatters: 'Why it matters.',
      collapsedByDefault: true,
    }).fixture;
    await fixture.whenStable();

    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('false');
  });

  it('never collapses the card when collapsedByDefault flips to true after mount, e.g. mid-typing', async () => {
    const { fixture } = setUp({
      prompt: 'List what you can control.',
      whyItMatters: 'Why it matters.',
      collapsedByDefault: false,
    });
    // `afterNextRender` reads the initial-render value asynchronously.
    await fixture.whenStable();
    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('true');

    fixture.componentRef.setInput('collapsedByDefault', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggleButton(fixture).getAttribute('aria-expanded')).toBe('true');
  });
});
