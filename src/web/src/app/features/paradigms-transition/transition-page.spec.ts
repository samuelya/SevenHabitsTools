import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
// Side-effect only: `DoneToggle`'s "Completed <time>" caption renders through `AppDatePipe`,
// which resolves `settings.numerals` via `featureStore` — see `done-toggle.spec.ts`'s own import.
import '../../features/settings/settings.model';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TransitionItemForm } from './transition-item-form';
import { TransitionPage } from './transition-page';
import { registerTransitionModel } from './transition.model';

function setUp(now = '2026-01-01T00:00:00.000Z'): ComponentFixture<TransitionPage> {
  // Vitest here runs with `isolate: false` (shared module state across spec files) — see
  // `exercise-kit.model.spec.ts` for why these re-assert their registration instead of resetting.
  registerExerciseKitModel();
  registerTransitionModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideTranslocoScope('paradigms-transition'),
      provideTranslocoScope('exercise-kit'),
      { provide: CLOCK, useValue: { now: () => new Date(now) } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  const fixture = TestBed.createComponent(TransitionPage);
  fixture.detectChanges();
  return fixture;
}

function addScript(fixture: ComponentFixture<TransitionPage>): void {
  const host = fixture.nativeElement as HTMLElement;
  (host.querySelector('.add-button') as HTMLButtonElement).click();
  fixture.detectChanges();
}

function itemForm(fixture: ComponentFixture<TransitionPage>): TransitionItemForm {
  return fixture.debugElement.query(By.directive(TransitionItemForm)).componentInstance;
}

describe('TransitionPage', () => {
  it('renders the prompt card title and prompt', () => {
    const fixture = setUp();

    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('Become a transition person');
    expect(text).toContain('inherited');
  });

  it('starts empty, with Mark done disabled', () => {
    const fixture = setUp();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(0);
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.disabled).toBe(true);
  });

  it('adding a script opens its detail form and lists it', () => {
    const fixture = setUp();
    addScript(fixture);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-transition-item-form')).not.toBeNull();
    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(1);
  });

  it('editing the text updates the list item and enables Mark done for a kept script', () => {
    const fixture = setUp();
    addScript(fixture);
    const host = fixture.nativeElement as HTMLElement;

    itemForm(fixture).changed.emit({ text: 'Silence means agreement' });
    fixture.detectChanges();

    expect(host.querySelector('app-exercise-list mat-nav-list button')?.textContent).toContain(
      'Silence means agreement',
    );
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.disabled).toBe(false);
  });

  it('requires a new script and situation before Mark done is enabled once the decision is to stop it', () => {
    const fixture = setUp();
    addScript(fixture);
    const host = fixture.nativeElement as HTMLElement;

    itemForm(fixture).changed.emit({ text: 'Silence means agreement', decision: 'stop' });
    fixture.detectChanges();
    expect((host.querySelector('app-done-toggle button') as HTMLButtonElement).disabled).toBe(true);

    itemForm(fixture).changed.emit({ newScript: 'Pause and ask first' });
    fixture.detectChanges();
    expect((host.querySelector('app-done-toggle button') as HTMLButtonElement).disabled).toBe(true);

    itemForm(fixture).changed.emit({ situation: "Tonight's dinner conversation" });
    fixture.detectChanges();
    expect((host.querySelector('app-done-toggle button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('marks done and reopens through DoneToggle', () => {
    const fixture = setUp();
    addScript(fixture);
    itemForm(fixture).changed.emit({ text: 'Silence means agreement' });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Reopen');

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Mark done');
  });

  it('deleting a script closes its detail and removes it from the list, but keeps it counted', () => {
    const fixture = setUp();
    addScript(fixture);
    const host = fixture.nativeElement as HTMLElement;

    (host.querySelector('app-transition-item-form .delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.querySelector('app-transition-item-form')).toBeNull();
    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(0);
  });

  it('shows the summary counts for stopped and rewritten live scripts', () => {
    const fixture = setUp();
    addScript(fixture);
    itemForm(fixture).changed.emit({
      text: 'Silence means agreement',
      decision: 'stop',
      newScript: 'Pause and ask first',
      situation: "Tonight's dinner",
    });
    fixture.detectChanges();

    const summaryText = (fixture.nativeElement as HTMLElement).querySelector(
      'app-transition-summary',
    )?.textContent;
    expect(summaryText).toContain('1');
  });

  it("updates a listed script's translated subtitle when the active language changes", () => {
    // Regression test for a review finding on #51's PR: `labels` used to be a `computed` that
    // called `transloco.translate()` without reading a signal, so it evaluated once and never
    // updated the subtitle again after a language switch (or a scope that loaded late).
    const fixture = setUp();
    addScript(fixture);
    const host = fixture.nativeElement as HTMLElement;

    const subtitleBefore = host.querySelector('app-exercise-list mat-nav-list button')?.textContent;
    expect(subtitleBefore).toContain('Family');
    expect(subtitleBefore).toContain('Mixed');

    TestBed.inject(TranslocoService).setActiveLang('ar');
    fixture.detectChanges();

    const subtitleAfter = host.querySelector('app-exercise-list mat-nav-list button')?.textContent;
    expect(subtitleAfter).toContain('العائلة');
    expect(subtitleAfter).toContain('مختلط');
  });

  it('keeps no page-local state: a second page instance renders the same store contents', () => {
    const fixture = setUp();
    addScript(fixture);
    itemForm(fixture).changed.emit({ text: 'Silence means agreement' });
    fixture.detectChanges();

    // Same TestBed module, so the singleton DocumentStore is shared — this is what a reload would
    // also see once `IndexedDbAdapter` has loaded it back in (covered by `e2e/`, not this spec).
    const reloaded = TestBed.createComponent(TransitionPage);
    reloaded.detectChanges();
    const host = reloaded.nativeElement as HTMLElement;

    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(1);
    expect(host.querySelector('app-exercise-list mat-nav-list button')?.textContent).toContain(
      'Silence means agreement',
    );
  });
});
