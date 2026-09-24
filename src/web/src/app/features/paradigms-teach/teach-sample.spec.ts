import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TeachItemForm } from './teach-item-form';
import { registerTeachModel, TEACH_MODEL_KEY, TEACH_ROUTE, TeachEntry } from './teach.model';
import teachRoutes from './teach.routes';

/** "Try this example" (issue #232), apart from `teach-page.spec.ts` to keep both files under the
 * 500-line rule. Same harness: the feature mounted at its real `TEACH_ROUTE`. */
const LIST_URL = `/${TEACH_ROUTE}`;

const EXAMPLE = {
  chapter: 'paradigms',
  keyIdea: 'How I see a problem shapes what I do.',
  person: 'My sister',
  status: 'shared',
};

async function setUp(): Promise<RouterTestingHarness> {
  registerExerciseKitModel();
  registerTeachModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter([{ path: TEACH_ROUTE, children: teachRoutes }], withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => new Date('2026-01-10T00:00:00.000Z') } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: DeleteWithUndo, useValue: { confirmAndDelete: vi.fn() } },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

function promptCard(harness: RouterTestingHarness): ExercisePromptCard {
  return harness.routeDebugElement!.query(By.directive(ExercisePromptCard)).componentInstance;
}

async function tryExample(
  harness: RouterTestingHarness,
  sample: Record<string, unknown>,
): Promise<void> {
  promptCard(harness).exampleTried.emit(sample);
  harness.detectChanges();
  await harness.fixture.whenStable();
}

function store() {
  return TestBed.runInInjectionContext(() => featureStore<TeachEntry[]>(TEACH_MODEL_KEY));
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

describe('TeachPage "Try this example" (issue #232)', () => {
  it("fills the example's chapter as a sample and opens that chapter's editor", async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);

    const entries = store().value();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ...EXAMPLE, plannedAt: '2026-01-12', sample: true });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/paradigms`);
    const form = harness.routeDebugElement!.query(By.directive(TeachItemForm));
    expect((form.componentInstance as TeachItemForm).entry().keyIdea).toBe(EXAMPLE.keyIdea);
  });

  it('shows the "Example" chip and counts toward nothing, until the first edit', async () => {
    const harness = await setUp();
    await tryExample(harness, EXAMPLE);

    const chipsOf = () =>
      [...host(harness).querySelectorAll('.exercise-list__chip')].map((chip) =>
        chip.textContent?.trim(),
      );
    expect(chipsOf()).toContain('Example');
    expect(host(harness).querySelector('app-teach-summary')).toBeNull();
    const markDone = () =>
      (host(harness).querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      );
    expect(markDone()).toBe('true');

    const form = harness.routeDebugElement!.query(By.directive(TeachItemForm));
    (form.componentInstance as TeachItemForm).changed.emit({ person: 'My brother' });
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect('sample' in store().value()[0]).toBe(false);
    expect(chipsOf()).not.toContain('Example');
    expect(host(harness).querySelector('app-teach-summary')).not.toBeNull();
    expect(markDone()).toBe('false');
  });

  it("never overwrites a chapter's own entry, and the guide stops offering it", async () => {
    const harness = await setUp();
    const own: TeachEntry = {
      id: 'own',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      chapter: 'paradigms',
      keyIdea: 'My own words',
      plannedAt: '2026-01-20',
      status: 'planned',
    };
    store().update(() => [own]);
    harness.detectChanges();
    await harness.fixture.whenStable();

    const guide = promptCard(harness).guide();
    expect(guide?.examples.length).toBeGreaterThan(0);
    expect(guide?.examples.every((example) => !('sample' in example) || !example.sample)).toBe(
      true,
    );

    await tryExample(harness, EXAMPLE);

    expect(store().value()).toEqual([own]);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
  });
});
