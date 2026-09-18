import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { AppSnackbar } from '../../core/layout/app-snackbar';
import { CLOCK } from '../../core/time/clock';
// Side-effect only: `DoneToggle`'s "Completed <time>" caption renders through `AppDatePipe`,
// which resolves `settings.numerals` via `featureStore` — see `done-toggle.spec.ts`'s own import.
import '../../features/settings/settings.model';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TransitionItemForm } from './transition-item-form';
import transitionRoutes from './transition.routes';
import { registerTransitionModel, TRANSITION_ROUTE } from './transition.model';

/** `TRANSITION_ROUTE`, not '/': `transition-page.ts`'s navigation is absolute, and this feature's
 * own `transition.routes.ts` already nests one componentless '' grouping route inside the '' or
 * ':itemId` leaf — mounting it at the harness *root* instead of at its real `ROUTE_REGISTRY`
 * prefix would hide exactly the nesting-depth bug `goTo()`'s doc comment describes. */
const LIST_URL = `/${TRANSITION_ROUTE}`;

function testRoutes(): Routes {
  return [{ path: TRANSITION_ROUTE, children: transitionRoutes }];
}

/** A fake `AppSnackbar` (same shape `app-update.service.spec.ts` uses): the real one loads
 * `@angular/material/snack-bar` through a dynamic `import()`, which can still be resolving after
 * a test (and this TestBed's `EnvironmentInjector`) has torn down, throwing an unrelated `NG0205`
 * as an unhandled rejection in whichever test runs next. */
function fakeSnackbar(): { open: ReturnType<typeof vi.fn>; action: Subject<void> } {
  const action = new Subject<void>();
  const open = vi.fn(async () => ({ onAction: () => action }));
  return { open, action };
}

/**
 * `TransitionPage`'s selection is the `:itemId` child route (issue #187, owner decision on #184:
 * option (b)) — not a page-local signal — so this exercises it through a real `Router`, the same
 * `RouterTestingHarness` pattern `build-routes.spec.ts`/`exercise-registry-routes.spec.ts` use,
 * mounting `transition.routes.ts` at its real `TRANSITION_ROUTE` prefix (`testRoutes()` above)
 * rather than rebuilding a parallel route table.
 */
async function setUp(
  options: { now?: string; snackbar?: ReturnType<typeof fakeSnackbar> } = {},
): Promise<RouterTestingHarness> {
  // Vitest here runs with `isolate: false` (shared module state across spec files) — see
  // `exercise-kit.model.spec.ts` for why these re-assert their registration instead of resetting.
  registerExerciseKitModel();
  registerTransitionModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      {
        provide: CLOCK,
        useValue: { now: () => new Date(options.now ?? '2026-01-01T00:00:00.000Z') },
      },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: AppSnackbar, useValue: options.snackbar ?? fakeSnackbar() },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

async function addScript(harness: RouterTestingHarness): Promise<void> {
  const host = harness.routeNativeElement as HTMLElement;
  (host.querySelector('.add-button') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

function itemForm(harness: RouterTestingHarness): TransitionItemForm {
  return harness.routeDebugElement!.query(By.directive(TransitionItemForm)).componentInstance;
}

describe('TransitionPage', () => {
  it('renders the prompt card title and prompt', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.textContent).toContain('Become a transition person');
    expect(host.textContent).toContain('inherited');
  });

  it('starts empty, with Mark done disabled', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(0);
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.disabled).toBe(true);
  });

  it('adding a script navigates to its child route and opens the full-screen editor', async () => {
    const harness = await setUp();
    await addScript(harness);
    const host = harness.routeNativeElement as HTMLElement;

    expect(TestBed.inject(Router).url).toMatch(new RegExp(`^${LIST_URL}/[^/]+$`));
    expect(host.querySelector('app-transition-item-form')).not.toBeNull();
    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(1);
  });

  it('editing the text updates the list item and enables Mark done for a kept script', async () => {
    const harness = await setUp();
    await addScript(harness);
    const host = harness.routeNativeElement as HTMLElement;

    itemForm(harness).changed.emit({ text: 'Silence means agreement' });
    harness.detectChanges();

    expect(host.querySelector('app-exercise-list mat-nav-list button')?.textContent).toContain(
      'Silence means agreement',
    );
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.disabled).toBe(false);
  });

  it('requires a new script and situation before Mark done is enabled once the decision is to stop it', async () => {
    const harness = await setUp();
    await addScript(harness);
    const host = harness.routeNativeElement as HTMLElement;

    itemForm(harness).changed.emit({ text: 'Silence means agreement', decision: 'stop' });
    harness.detectChanges();
    expect((host.querySelector('app-done-toggle button') as HTMLButtonElement).disabled).toBe(true);

    itemForm(harness).changed.emit({ newScript: 'Pause and ask first' });
    harness.detectChanges();
    expect((host.querySelector('app-done-toggle button') as HTMLButtonElement).disabled).toBe(true);

    itemForm(harness).changed.emit({ situation: "Tonight's dinner conversation" });
    harness.detectChanges();
    expect((host.querySelector('app-done-toggle button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('marks done and reopens through DoneToggle', async () => {
    const harness = await setUp();
    await addScript(harness);
    itemForm(harness).changed.emit({ text: 'Silence means agreement' });
    harness.detectChanges();
    const host = harness.routeNativeElement as HTMLElement;

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Reopen');

    (host.querySelector('app-done-toggle button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(host.querySelector('app-done-toggle')?.textContent).toContain('Mark done');
  });

  it('deleting a script closes its editor, returns to the list route, and removes it from the list, but keeps it counted', async () => {
    const snackbar = fakeSnackbar();
    const harness = await setUp({ snackbar });
    await addScript(harness);

    (
      harness.routeNativeElement!.querySelector(
        'app-transition-item-form .delete-button',
      ) as HTMLButtonElement
    ).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement as HTMLElement;

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(host.querySelector('app-transition-item-form')).toBeNull();
    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(0);
    expect(snackbar.open).toHaveBeenCalledWith('Script deleted', 'Undo', { duration: 5000 });
  });

  it('restores the deleted script when Undo is clicked on the snackbar', async () => {
    const snackbar = fakeSnackbar();
    const harness = await setUp({ snackbar });
    await addScript(harness);

    (
      harness.routeNativeElement!.querySelector(
        'app-transition-item-form .delete-button',
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();

    snackbar.action.next();
    harness.detectChanges();
    await harness.navigateByUrl(LIST_URL);

    expect(
      harness.routeNativeElement?.querySelectorAll('app-exercise-list mat-nav-list button'),
    ).toHaveLength(1);
  });

  it('redirects to the list when :itemId is not a live script', async () => {
    const harness = await setUp();
    await harness.navigateByUrl(`${LIST_URL}/not-a-real-id`);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).toBeNull();
  });

  it('reopens the editor on a fresh navigation straight to an existing item id (deep link)', async () => {
    const harness = await setUp();
    await addScript(harness);
    const id = TestBed.inject(Router).url.slice(LIST_URL.length + 1);

    await harness.navigateByUrl(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).toBeNull();

    await harness.navigateByUrl(`${LIST_URL}/${id}`);
    expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).not.toBeNull();
  });

  it('shows the summary counts for stopped and rewritten live scripts', async () => {
    const harness = await setUp();
    await addScript(harness);
    itemForm(harness).changed.emit({
      text: 'Silence means agreement',
      decision: 'stop',
      newScript: 'Pause and ask first',
      situation: "Tonight's dinner",
    });
    harness.detectChanges();

    const summaryText =
      harness.routeNativeElement?.querySelector('app-transition-summary')?.textContent;
    expect(summaryText).toContain('1');
  });

  it("updates a listed script's translated subtitle when the active language changes", async () => {
    // Regression test for a review finding on #51's PR: `labels` used to be a `computed` that
    // called `transloco.translate()` without reading a signal, so it evaluated once and never
    // updated the subtitle again after a language switch (or a scope that loaded late).
    const harness = await setUp();
    await addScript(harness);
    const host = harness.routeNativeElement as HTMLElement;

    const subtitleBefore = host.querySelector('app-exercise-list mat-nav-list button')?.textContent;
    expect(subtitleBefore).toContain('Family');
    expect(subtitleBefore).toContain('Mixed');

    TestBed.inject(TranslocoService).setActiveLang('ar');
    harness.detectChanges();

    const subtitleAfter = host.querySelector('app-exercise-list mat-nav-list button')?.textContent;
    expect(subtitleAfter).toContain('العائلة');
    expect(subtitleAfter).toContain('مختلط');
  });

  it('keeps no page-local state: a fresh navigation renders the same store contents', async () => {
    const harness = await setUp();
    await addScript(harness);
    itemForm(harness).changed.emit({ text: 'Silence means agreement' });
    harness.detectChanges();

    // Same TestBed module, so the singleton DocumentStore is shared — this is what a reload would
    // also see once `IndexedDbAdapter` has loaded it back in (covered by `e2e/`, not this spec).
    await harness.navigateByUrl(LIST_URL);
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelectorAll('app-exercise-list mat-nav-list button')).toHaveLength(1);
    expect(host.querySelector('app-exercise-list mat-nav-list button')?.textContent).toContain(
      'Silence means agreement',
    );
  });
});
