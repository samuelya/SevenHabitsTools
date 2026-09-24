import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExerciseGuide, ExerciseGuideData } from './exercise-guide';

function setUp(data: ExerciseGuideData, close = vi.fn()) {
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('exercise-kit'),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(ExerciseGuide);
  fixture.detectChanges();
  return { fixture, close };
}

const CONTENT: ExerciseGuideData = {
  content: {
    inShort: 'You will read a scene and guess what happened.',
    howTo: ['Read the scene.', 'Write your guess.'],
    examples: [
      {
        title: 'Step 1',
        fields: [{ label: 'Your first guess', value: "They're annoyed." }],
      },
    ],
    afterwards: 'Catch one moment this week.',
  },
};

describe('ExerciseGuide', () => {
  it('renders the four generic section headings', () => {
    const { fixture } = setUp(CONTENT);
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('In short');
    expect(text).toContain('How to do it');
    expect(text).toContain('An example');
    expect(text).toContain('Afterwards');
  });

  it("renders the exercise's own content", () => {
    const { fixture } = setUp(CONTENT);
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('You will read a scene and guess what happened.');
    expect(text).toContain('Read the scene.');
    expect(text).toContain('Write your guess.');
    expect(text).toContain('Step 1');
    expect(text).toContain('Your first guess');
    expect(text).toContain("They're annoyed.");
    expect(text).toContain('Catch one moment this week.');
  });

  it('closes through the close button', () => {
    const { fixture, close } = setUp(CONTENT);

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.exercise-guide-close',
      ) as HTMLButtonElement
    ).click();

    expect(close).toHaveBeenCalled();
  });

  it('uses a given title instead of the generic one, and skips empty sections (#219)', () => {
    const { fixture } = setUp({
      title: 'About this habit',
      content: { inShort: 'The intro.', howTo: [], examples: [], afterwards: '' },
    });
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent as string;

    expect(element.querySelector('.exercise-guide-title')?.textContent?.trim()).toBe(
      'About this habit',
    );
    expect(text).toContain('The intro.');
    expect(text).not.toContain('How to do it');
    expect(text).not.toContain('An example');
    expect(text).not.toContain('Afterwards');
    expect(element.querySelectorAll('section')).toHaveLength(1);
  });
});
