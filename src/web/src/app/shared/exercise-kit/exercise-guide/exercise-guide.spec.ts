import { Component, TemplateRef, viewChild } from '@angular/core';
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

  describe('card examples (#230)', () => {
    // Test fixture for a list exercise's branching item (the shape #231 fills in for Transition):
    // one example per branch, rendered as the item's list row plus its fields.
    const CARDS: ExerciseGuideData = {
      content: {
        inShort: 'Name a pattern you learned at home.',
        howTo: ['Add a script.'],
        examples: [
          {
            kind: 'card',
            title: 'We talk things through at dinner',
            subtitle: 'Family · Helps · Keep',
            done: true,
            fields: [{ label: 'Your decision', value: 'Keep' }],
          },
          {
            kind: 'card',
            title: 'I go quiet when I am angry',
            subtitle: 'Family · Holds me back · Rewrite',
            fields: [
              { label: 'The new script', value: 'I say what bothers me the same day.' },
              { label: 'A situation this week', value: 'Friday planning meeting.' },
            ],
            sample: { text: 'I go quiet when I am angry', decision: 'rewrite' },
          },
          { kind: 'fields', title: 'Step 1', fields: [{ label: 'Label', value: 'Value' }] },
        ],
        afterwards: '',
      },
    };

    it('renders a card example as a list row with a subtitle line, then its fields', () => {
      const { fixture } = setUp(CARDS);
      const element = fixture.nativeElement as HTMLElement;
      const cards = element.querySelectorAll('.example-card--item');

      expect(cards).toHaveLength(2);
      expect(cards[0].querySelector('.example-item-title')?.textContent?.trim()).toBe(
        'We talk things through at dinner',
      );
      expect(cards[0].querySelector('.example-item-subtitle')?.textContent?.trim()).toBe(
        'Family · Helps · Keep',
      );
      expect(cards[1].querySelectorAll('.example-field')).toHaveLength(2);
      expect(cards[1].textContent).toContain('I say what bothers me the same day.');
    });

    it('marks a done card with a labelled check, and leaves the icon slot empty otherwise', () => {
      const { fixture } = setUp(CARDS);
      const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.example-card--item');

      const check = cards[0].querySelector('.example-item-icon mat-icon');
      expect(check?.getAttribute('aria-label')).toBe('Done');
      expect(cards[1].querySelector('.example-item-icon mat-icon')).toBeNull();
      expect(cards[1].querySelector('.example-item-icon')).not.toBeNull();
    });

    it('offers "Try this example" only on a card with a sample, closing with it (#232)', () => {
      const { fixture, close } = setUp(CARDS);
      const element = fixture.nativeElement as HTMLElement;
      const cards = element.querySelectorAll('.example-card--item');

      expect(cards[0].querySelector('.try-example')).toBeNull();
      expect(element.querySelectorAll('.try-example')).toHaveLength(1);
      const button = cards[1].querySelector('.try-example') as HTMLButtonElement;
      expect(button.textContent?.trim()).toContain('Try this example');
      // Every card's button reads the same, so it names its example through the card's title.
      const describedBy = button.getAttribute('aria-describedby') as string;
      expect(element.querySelector(`#${describedBy}`)?.textContent?.trim()).toBe(
        'I go quiet when I am angry',
      );

      button.click();

      expect(close).toHaveBeenCalledWith({
        tryExample: { text: 'I go quiet when I am angry', decision: 'rewrite' },
      });
    });

    it('still renders a fields example (kind omitted or "fields") as a titled field list', () => {
      const { fixture } = setUp(CARDS);
      const element = fixture.nativeElement as HTMLElement;

      const fieldCards = element.querySelectorAll('.example-card:not(.example-card--item)');
      expect(fieldCards).toHaveLength(1);
      expect(fieldCards[0].querySelector('mat-card-title')?.textContent?.trim()).toBe('Step 1');
    });
  });

  it("renders the caller's extra section right after In short (#230)", () => {
    @Component({
      template: `<ng-template #extra><p class="extra-marker">Five exercises</p></ng-template>`,
    })
    class ExtraHost {
      readonly extra = viewChild.required<TemplateRef<unknown>>('extra');
    }
    const dialogData: { value?: ExerciseGuideData } = {};
    TestBed.configureTestingModule({
      imports: [ExtraHost],
      providers: [
        provideTranslocoTesting(),
        provideTranslocoScope('exercise-kit'),
        // Read lazily, once `ExerciseGuide` is created below, so it can carry the host's template.
        { provide: MAT_DIALOG_DATA, useFactory: () => dialogData.value },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const host = TestBed.createComponent(ExtraHost);
    host.detectChanges();
    dialogData.value = {
      title: 'About this habit',
      content: { inShort: 'The intro.', howTo: [], examples: [], afterwards: '' },
      extra: host.componentInstance.extra(),
    };
    const fixture = TestBed.createComponent(ExerciseGuide);
    fixture.detectChanges();
    const sections = (fixture.nativeElement as HTMLElement).querySelectorAll('section');

    expect(sections).toHaveLength(2);
    expect(sections[1].querySelector('.extra-marker')?.textContent).toBe('Five exercises');
  });
});
