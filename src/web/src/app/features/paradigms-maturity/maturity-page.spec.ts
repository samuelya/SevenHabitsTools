import { DebugElement, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { By } from '@angular/platform-browser';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { MaturityPage } from './maturity-page';
import { MATURITY_MODEL_KEY, MaturityAssessment } from './maturity.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import maturityRoutes from './maturity.routes';
import { MATURITY_ROUTE, registerMaturityModel } from './maturity.model';

const LIST_URL = `/${MATURITY_ROUTE}`;

function testRoutes(): Routes {
  return [{ path: MATURITY_ROUTE, children: maturityRoutes }];
}

/** Same shape as `paradigms-transition/transition-page.spec.ts`'s own fake — see its doc comment
 * for why the real `DeleteWithUndo` isn't used directly in a page spec. */
function fakeDeleteWithUndo(): {
  confirmAndDelete: ReturnType<typeof vi.fn>;
  calls: ConfirmAndDeleteOptions[];
} {
  const calls: ConfirmAndDeleteOptions[] = [];
  const confirmAndDelete = vi.fn(async (options: ConfirmAndDeleteOptions) => {
    calls.push(options);
  });
  return { confirmAndDelete, calls };
}

async function setUp(
  now = '2026-01-01T00:00:00.000Z',
  deleteWithUndo: ReturnType<typeof fakeDeleteWithUndo> = fakeDeleteWithUndo(),
): Promise<RouterTestingHarness> {
  // Vitest here runs with `isolate: false` (shared module state) — see `exercise-kit.model.spec.ts`.
  registerExerciseKitModel();
  registerMaturityModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => new Date(now) } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: DeleteWithUndo, useValue: deleteWithUndo },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

/** Taps "New assessment": opens the editor on an in-memory draft at `new` (issue #217). */
async function openDraft(harness: RouterTestingHarness): Promise<void> {
  const host = harness.routeNativeElement as HTMLElement;
  (host.querySelector('.add-button') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

/** A saved assessment: open the draft, then rate the first area, which saves it (issue #217). */
async function addAssessment(harness: RouterTestingHarness): Promise<void> {
  await openDraft(harness);
  rateArea(harness, 0, 2);
  await harness.fixture.whenStable();
}

function storedAssessments(): readonly MaturityAssessment[] {
  return TestBed.runInInjectionContext(() =>
    featureStore<MaturityAssessment[]>(MATURITY_MODEL_KEY).value(),
  );
}

function editorStatus(harness: RouterTestingHarness): string | undefined {
  return harness.routeNativeElement?.querySelector('.editor-status')?.textContent?.trim();
}

function rateArea(harness: RouterTestingHarness, index: number, level: 1 | 2 | 3): void {
  const rows = (harness.routeNativeElement as HTMLElement).querySelectorAll('.area-row');
  const radios = rows[index].querySelectorAll(
    '.level-option input[type="radio"]',
  ) as NodeListOf<HTMLInputElement>;
  radios[level - 1].click();
  harness.detectChanges();
}

describe('MaturityPage', () => {
  it('renders the prompt card title', async () => {
    const harness = await setUp();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      'See where you stand on the growth continuum',
    );
  });

  it('glosses the growth continuum inline under the prompt on first use (#218)', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelector('.prompt-gloss')?.textContent?.trim()).toBe(
      "Growth continuum: dependence → independence → interdependence, the book's growth line.",
    );
  });

  it('shows no summary card and the gate checklist until the first item exists (#215)', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelector('app-maturity-summary')).toBeNull();
    expect(host.querySelector('app-done-toggle .done-checklist')?.textContent).toContain(
      'Rate every area in one assessment',
    );

    await addAssessment(harness);
    harness.detectChanges();

    expect(host.querySelector('app-maturity-summary')).not.toBeNull();
  });

  it('starts with no history and Mark done disabled', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;
    expect(host.querySelectorAll('app-assessment-history-list button')).toHaveLength(0);
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(true);
  });

  it('New assessment opens an unsaved draft at `new` with the six built-in areas (issue #217)', async () => {
    const harness = await setUp();
    await openDraft(harness);

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    const host = harness.routeNativeElement as HTMLElement;
    expect(host.querySelectorAll('.area-row')).toHaveLength(6);
    expect((host.querySelector('.area-row input') as HTMLInputElement).placeholder).toBe('Work');
    expect(editorStatus(harness)).toBe('New');
    expect(storedAssessments()).toHaveLength(0);
  });

  it('backing out of an untouched draft leaves no assessment (issue #217)', async () => {
    const harness = await setUp();
    await openDraft(harness);
    (harness.routeNativeElement!.querySelector('.editor-close') as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(storedAssessments()).toHaveLength(0);
  });

  it('rating the first area saves the draft and moves the URL to its id (issue #217)', async () => {
    const harness = await setUp();
    await addAssessment(harness);

    const stored = storedAssessments();
    expect(stored).toHaveLength(1);
    expect(stored[0].areas[0].level).toBe(2);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored[0].id}`);
    expect(editorStatus(harness)).toBe('Saved');
  });

  it('compares an unsaved draft with the latest saved assessment (issue #217)', async () => {
    // An earlier one (this spec's clock is fixed, so two assessments made through the page would
    // tie on both date and createdAt and leave their order to the sort's stability).
    const harness = await setUp();
    TestBed.runInInjectionContext(() =>
      featureStore<MaturityAssessment[]>(MATURITY_MODEL_KEY).update((current) => [
        ...current,
        newRecord({ date: '2025-12-01', areas: [] } as const, new Date('2025-12-01T00:00:00.000Z')),
      ]),
    );
    await openDraft(harness);

    const page = harness.routeDebugElement!.componentInstance as { previous: () => unknown };
    expect(page.previous()).toEqual(storedAssessments()[0]);
  });

  it('keeps Mark done disabled until every area has a level', async () => {
    const harness = await setUp();
    await addAssessment(harness);
    const host = harness.routeNativeElement as HTMLElement;

    for (let i = 0; i < 5; i++) {
      rateArea(harness, i, 2);
    }
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(true);

    rateArea(harness, 5, 2);
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(false);
  });

  it('shows the overall profile once at least one area is rated', async () => {
    const harness = await setUp();
    await addAssessment(harness);
    rateArea(harness, 0, 1);

    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Dependence');
  });

  it('marks done and reopens through DoneToggle', async () => {
    const harness = await setUp();
    await addAssessment(harness);
    for (let i = 0; i < 6; i++) {
      rateArea(harness, i, 2);
    }
    const host = harness.routeNativeElement as HTMLElement;

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Reopen');

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Mark done');
  });

  it('redirects to the history when :itemId is not a live assessment', async () => {
    const harness = await setUp();
    await harness.navigateByUrl(`${LIST_URL}/not-a-real-id`);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-maturity-assessment-form')).toBeNull();
  });

  it('deleting an assessment asks DeleteWithUndo to confirm, then removes it and closes the editor', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp(undefined, deleteWithUndo);
    await addAssessment(harness);
    const host = harness.routeNativeElement as HTMLElement;

    (host.querySelector('.assessment-history-list__delete') as HTMLButtonElement).click();

    expect(deleteWithUndo.calls).toHaveLength(1);
    expect(deleteWithUndo.calls[0].deletedMessage).toBe('Assessment deleted');

    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-maturity-assessment-form')).toBeNull();
    expect(
      harness.routeNativeElement?.querySelectorAll('.assessment-history-list__item'),
    ).toHaveLength(0);
  });

  it('restores the deleted assessment when DeleteWithUndo reports Undo', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp(undefined, deleteWithUndo);
    await addAssessment(harness);
    (
      (harness.routeNativeElement as HTMLElement).querySelector(
        '.assessment-history-list__delete',
      ) as HTMLButtonElement
    ).click();
    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();

    deleteWithUndo.calls[0].onUndo();
    harness.detectChanges();
    await harness.navigateByUrl(LIST_URL);

    expect(
      harness.routeNativeElement?.querySelectorAll('.assessment-history-list__item'),
    ).toHaveLength(1);
  });
});

describe('MaturityPage intro card (issue #216)', () => {
  function promptCardIn(debugElement: DebugElement): ExercisePromptCard {
    return debugElement.query(By.directive(ExercisePromptCard)).componentInstance;
  }

  it('starts expanded on a first visit, before anything is saved (desktop)', async () => {
    const harness = await setUp();
    expect(promptCardIn(harness.fixture.debugElement).expanded()).toBe(true);
  });

  it('starts collapsed on a later visit once a live assessment exists (desktop)', async () => {
    await setUp();
    TestBed.runInInjectionContext(() =>
      featureStore<MaturityAssessment[]>(MATURITY_MODEL_KEY).update((current) => [
        ...current,
        newRecord({ date: '2026-01-01', areas: [] } as const, new Date('2026-01-01T00:00:00.000Z')),
      ]),
    );

    const fixture = TestBed.createComponent(MaturityPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(promptCardIn(fixture.debugElement).expanded()).toBe(false);
  });
});
