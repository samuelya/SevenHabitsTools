import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSliderThumb } from '@angular/material/slider';
import { By } from '@angular/platform-browser';
import { provideTranslocoScope } from '@jsverse/transloco';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { featureStore } from '../../core/data/feature-store';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { PerceptionPage } from './perception-page';
import {
  PERCEPTION_MODEL_KEY,
  PerceptionExercise,
  registerPerceptionModel,
} from './perception.model';

async function setUp(now = '2026-01-10T00:00:00.000Z'): Promise<ComponentFixture<PerceptionPage>> {
  // Vitest here runs with `isolate: false` (shared module state) — see `exercise-kit.model.spec.ts`.
  registerExerciseKitModel();
  registerPerceptionModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('paradigms-perception'),
      provideTranslocoScope('exercise-kit'),
      { provide: CLOCK, useValue: { now: () => new Date(now) } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(PerceptionPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

// Every step's fields are in the DOM at once (`GuidedStepper` doesn't use Material's lazy
// `matStepContent`, only CSS to hide the unselected steps), so tests scope queries by each step's
// own container class rather than by a flat, position-based `textarea` index.
function textareasIn(
  fixture: ComponentFixture<PerceptionPage>,
  containerClass: string,
): HTMLTextAreaElement[] {
  return [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLTextAreaElement>(
      `${containerClass} textarea`,
    ),
  ];
}

function textareas(fixture: ComponentFixture<PerceptionPage>): HTMLTextAreaElement[] {
  return textareasIn(fixture, '.step-two-views');
}

function setText(textarea: HTMLTextAreaElement, value: string): void {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input'));
}

function advance(fixture: ComponentFixture<PerceptionPage>): void {
  const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  const next = buttons.find((button) => button.textContent?.trim() === 'Next');
  (next as HTMLButtonElement).click();
  fixture.detectChanges();
}

function record(): PerceptionExercise | null {
  return TestBed.runInInjectionContext(() =>
    featureStore<PerceptionExercise | null>(PERCEPTION_MODEL_KEY),
  ).value();
}

describe('PerceptionPage', () => {
  it('renders the prompt title and creates no record until the first edit', async () => {
    const fixture = await setUp();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Notice your paradigm');
    expect(record()).toBeNull();
    const markDone = (fixture.nativeElement as HTMLElement).querySelector(
      'app-done-toggle button',
    ) as HTMLButtonElement;
    expect(markDone.disabled).toBe(true);
  });

  it('does not reveal the alternative view until the reveal button is clicked', async () => {
    const fixture = await setUp();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('The rest of the story');

    const revealButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Show what was really going on',
    ) as HTMLButtonElement;
    expect(revealButton.disabled).toBe(true);

    setText(textareas(fixture)[0], 'They must be upset with me');
    fixture.detectChanges();
    expect(revealButton.disabled).toBe(false);

    revealButton.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('The rest of the story');
    expect(record()?.firstView).toBe('They must be upset with me');
  });

  it('keeps the alternative view revealed after the page is destroyed and recreated, even without a switch-difficulty rating yet', async () => {
    // Regression test for a review finding: `revealed` used to be a page-local signal seeded
    // once from `isStepOneComplete()`, so navigating away and back (Angular destroys and
    // recreates this component; there is no custom `RouteReuseStrategy` for this route) reset it
    // to `false` whenever the user had revealed view B but not yet rated the slider.
    const fixture = await setUp();
    const host = fixture.nativeElement as HTMLElement;
    setText(textareas(fixture)[0], 'They must be upset with me');
    fixture.detectChanges();
    (
      [...host.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Show what was really going on',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(record()?.viewBRevealed).toBe(true);
    expect(record()?.switchDifficulty).toBeNull();

    fixture.destroy();
    const recreated = TestBed.createComponent(PerceptionPage);
    recreated.detectChanges();

    expect((recreated.nativeElement as HTMLElement).textContent).toContain('The rest of the story');
  });

  it('persists the switch-difficulty slider once revealed', async () => {
    const fixture = await setUp();
    const host = fixture.nativeElement as HTMLElement;
    setText(textareas(fixture)[0], 'They must be upset with me');
    fixture.detectChanges();
    (
      [...host.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Show what was really going on',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const thumb = fixture.debugElement
      .query(By.directive(MatSliderThumb))
      .injector.get(MatSliderThumb);
    thumb.valueChange.emit(4);
    fixture.detectChanges();

    expect(record()?.switchDifficulty).toBe(4);
  });

  it('fills all three steps and enables Mark done, then completes it through DoneToggle', async () => {
    const fixture = await setUp();
    const host = fixture.nativeElement as HTMLElement;

    // Step 1
    setText(textareas(fixture)[0], 'They must be upset with me');
    fixture.detectChanges();
    (
      [...host.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Show what was really going on',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    fixture.debugElement
      .query(By.directive(MatSliderThumb))
      .injector.get(MatSliderThumb)
      .valueChange.emit(4);
    fixture.detectChanges();
    advance(fixture);

    // Step 2: 3 attempts, each a textarea, plus the difference sentence as the 4th
    const step2Fields = textareasIn(fixture, '.step-character-technique');
    setText(step2Fields[0], 'Tried a new morning routine');
    setText(step2Fields[1], 'Practiced listening before reacting');
    setText(step2Fields[2], 'Set a strict schedule');
    setText(step2Fields[3], 'One fades once effort stops; the other sticks.');
    fixture.detectChanges();
    // Tag the second attempt "Character" (the group's second toggle option).
    const kindGroups = host.querySelectorAll('.kind-toggle');
    (kindGroups[1].querySelectorAll('button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    advance(fixture);

    // Step 3: current chain, then the alt chain
    const step3Fields = textareasIn(fixture, '.step-see-do-get');
    setText(step3Fields[0], 'A distant coworker');
    setText(step3Fields[1], 'I avoid them');
    setText(step3Fields[2], 'A tense team');
    setText(step3Fields[3], 'A distracted coworker');
    setText(step3Fields[4], 'I check in with them');
    setText(step3Fields[5], 'A trusted team');
    fixture.detectChanges();

    const doneToggleButton = () =>
      host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(doneToggleButton().disabled).toBe(false);

    // `DoneToggle`'s template swaps to an entirely different `@else` button once `done()` flips
    // (`done-toggle.html`), so each click re-queries the button currently in the DOM rather than
    // reusing a now-detached reference.
    doneToggleButton().click();
    fixture.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Reopen');

    doneToggleButton().click();
    fixture.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Mark done');
  });

  it('creates the record once and keeps its id and createdAt stable across later edits', async () => {
    const fixture = await setUp();
    setText(textareas(fixture)[0], 'First edit');
    fixture.detectChanges();
    const id = record()?.id;
    const createdAt = record()?.createdAt;

    setText(textareas(fixture)[0], 'A later edit');
    fixture.detectChanges();

    expect(record()?.id).toBe(id);
    expect(record()?.createdAt).toBe(createdAt);
    expect(record()?.firstView).toBe('A later edit');
  });
});
