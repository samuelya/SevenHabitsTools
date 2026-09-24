import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { WriterRole } from '../../core/data/multi-tab/writer-role-state';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TransitionItemForm } from './transition-item-form';
import {
  registerTransitionModel,
  Script,
  TRANSITION_MODEL_KEY,
  TRANSITION_ROUTE,
} from './transition.model';
import transitionRoutes from './transition.routes';

/** "Try this example" (issue #232), apart from `transition-page.spec.ts` to keep both files under
 * the 500-line rule. Same harness: the feature mounted at its real `TRANSITION_ROUTE`. */
const LIST_URL = `/${TRANSITION_ROUTE}`;

const EXAMPLE = {
  text: 'We pay every bill the day it arrives.',
  source: 'family',
  effect: 'helps',
  decision: 'keep',
};

async function setUp(role: WriterRole = 'writer'): Promise<RouterTestingHarness> {
  registerExerciseKitModel();
  registerTransitionModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(
        [{ path: TRANSITION_ROUTE, children: transitionRoutes }],
        withComponentInputBinding(),
      ),
      { provide: CLOCK, useValue: { now: () => new Date('2026-01-01T00:00:00.000Z') } },
      {
        provide: WRITER_LOCK,
        useValue: { role: signal(role), isWriter: signal(role === 'writer') },
      },
      { provide: DeleteWithUndo, useValue: { confirmAndDelete: vi.fn() } },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

/** What `ExercisePromptCard` emits once the guide closes through "Try this example". */
async function tryExample(
  harness: RouterTestingHarness,
  sample: Record<string, unknown>,
): Promise<void> {
  const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));
  (card.componentInstance as ExercisePromptCard).exampleTried.emit(sample);
  harness.detectChanges();
  await harness.fixture.whenStable();
}

function storedScripts(): readonly Script[] {
  return TestBed.runInInjectionContext(() => featureStore<Script[]>(TRANSITION_MODEL_KEY).value());
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

describe('TransitionPage "Try this example" (issue #232)', () => {
  it('stores the example as a sample and opens the editor on it', async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);

    const [stored] = storedScripts();
    expect(storedScripts()).toHaveLength(1);
    expect(stored).toMatchObject({ ...EXAMPLE, sample: true });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored.id}`);
    const form = harness.routeDebugElement!.query(By.directive(TransitionItemForm));
    expect((form.componentInstance as TransitionItemForm).script().id).toBe(stored.id);
  });

  it('shows the "Example" chip and counts toward nothing: no summary, Mark done disabled', async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);

    const chips = [...host(harness).querySelectorAll('.exercise-list__chip')].map((chip) =>
      chip.textContent?.trim(),
    );
    expect(chips[0]).toBe('Example');
    expect(host(harness).querySelector('app-transition-summary')).toBeNull();
    const markDone = host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.getAttribute('aria-disabled')).toBe('true');
  });

  it("the first edit of any field makes it the user's own: no chip, counted", async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);

    const form = harness.routeDebugElement!.query(By.directive(TransitionItemForm));
    (form.componentInstance as TransitionItemForm).changed.emit({ source: 'work' });
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect('sample' in storedScripts()[0]).toBe(false);
    const chips = [...host(harness).querySelectorAll('.exercise-list__chip')].map((chip) =>
      chip.textContent?.trim(),
    );
    expect(chips).not.toContain('Example');
    expect(host(harness).querySelector('app-transition-summary')).not.toBeNull();
  });

  it('opens the live sample of the same example instead of adding it again', async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);
    const [first] = storedScripts();
    await harness.navigateByUrl(LIST_URL);

    await tryExample(harness, EXAMPLE);

    expect(storedScripts()).toHaveLength(1);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${first.id}`);
  });

  it("adds it again once the earlier copy is the user's own", async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);
    const form = harness.routeDebugElement!.query(By.directive(TransitionItemForm));
    (form.componentInstance as TransitionItemForm).changed.emit({ source: 'work' });
    await harness.fixture.whenStable();

    await tryExample(harness, EXAMPLE);

    expect(storedScripts()).toHaveLength(2);
    expect(storedScripts()[1].sample).toBe(true);
  });

  it('Back skips the blank draft it was tried from (replaceUrl)', async () => {
    const harness = await setUp();
    await harness.navigateByUrl(`${LIST_URL}/new`);
    await tryExample(harness, EXAMPLE);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${storedScripts()[0].id}`);

    const location = TestBed.inject(Location);
    location.back();
    expect(location.path()).not.toBe(`${LIST_URL}/new`);
  });

  it('stores and opens nothing for an invalid example', async () => {
    const harness = await setUp();
    await tryExample(harness, { ...EXAMPLE, source: 'school' });

    expect(storedScripts()).toHaveLength(0);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
  });

  it('stores and opens nothing in a read-only tab', async () => {
    const harness = await setUp('reader');
    await tryExample(harness, EXAMPLE);

    expect(storedScripts()).toHaveLength(0);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
  });
});
