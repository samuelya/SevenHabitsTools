import { DebugElement, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
// Side-effect only: `DoneToggle`'s "Completed <time>" caption renders through `AppDatePipe`,
// which resolves `settings.numerals` via `featureStore` — see `done-toggle.spec.ts`'s own import.
import '../../features/settings/settings.model';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { TransitionPage } from './transition-page';
import { TRANSITION_MODEL_KEY, Script } from './transition.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TransitionItemForm } from './transition-item-form';
import transitionRoutes from './transition.routes';
import { registerTransitionModel, TRANSITION_ROUTE } from './transition.model';

/** `TRANSITION_ROUTE`, not '/': `transition-page.ts`'s navigation is absolute, and mounting this
 * feature at the harness *root* instead of at its real `ROUTE_REGISTRY` prefix would hide exactly
 * the nesting-depth bug `goTo()`'s doc comment describes. */
const LIST_URL = `/${TRANSITION_ROUTE}`;

function testRoutes(): Routes {
  return [{ path: TRANSITION_ROUTE, children: transitionRoutes }];
}

/** A fake `DeleteWithUndo` (the real one loads `@angular/material/dialog` through a dynamic
 * `import()`, the same `NG0205`-after-teardown risk `app-update.service.spec.ts`'s `AppSnackbar`
 * fake avoids — playbook's "Delete, with Undo"): captures each call's options instead of actually
 * opening a dialog, so a test drives confirm/Undo itself by calling `onConfirm()`/`onUndo()`
 * directly — the dialog and the snackbar wiring are `DeleteWithUndo`'s own spec's job, not this
 * page's. */
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

/**
 * `TransitionPage`'s selection is the `:itemId` child route (issue #187, owner decision on #184:
 * option (b)) — not a page-local signal — so this exercises it through a real `Router`, the same
 * `RouterTestingHarness` pattern `build-routes.spec.ts`/`exercise-registry-routes.spec.ts` use,
 * mounting `transition.routes.ts` at its real `TRANSITION_ROUTE` prefix (`testRoutes()` above)
 * rather than rebuilding a parallel route table.
 */
async function setUp(
  options: {
    now?: string;
    deleteWithUndo?: ReturnType<typeof fakeDeleteWithUndo>;
    attached?: boolean;
  } = {},
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
      { provide: DeleteWithUndo, useValue: options.deleteWithUndo ?? fakeDeleteWithUndo() },
    ],
  });
  const harness = await RouterTestingHarness.create(LIST_URL);
  if (options.attached) {
    // `HTMLElement.focus()` on a still-detached element silently no-ops in jsdom, so the
    // focus-move assertions below need the harness in the real document.
    document.body.appendChild(harness.fixture.nativeElement);
  }
  return harness;
}

/** The routed `TransitionPage` instance currently in the outlet — the same object across an
 * open/close cycle is exactly what issue #187's route change is for. */
function pageInstance(harness: RouterTestingHarness): unknown {
  return harness.routeDebugElement!.componentInstance;
}

async function closeEditor(harness: RouterTestingHarness): Promise<void> {
  (harness.routeNativeElement!.querySelector('.editor-close') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

/** Taps "Add a script": opens the editor on an in-memory draft at `new` (issue #217). */
async function openDraft(harness: RouterTestingHarness): Promise<void> {
  const host = harness.routeNativeElement as HTMLElement;
  const addButton = host.querySelector('.add-button') as HTMLButtonElement;
  // A real click focuses the button first; jsdom's `.click()` doesn't, and the kit captures
  // whatever is focused at that moment as the element to restore focus to on close.
  addButton.focus();
  addButton.click();
  await harness.fixture.whenStable();
}

/** Adds a script the way a user does: open the draft, then type its text, which saves it. */
async function addScript(
  harness: RouterTestingHarness,
  text = 'Silence means agreement',
): Promise<void> {
  await openDraft(harness);
  itemForm(harness).changed.emit({ text });
  harness.detectChanges();
  await harness.fixture.whenStable();
}

function storedScripts(): readonly Script[] {
  return TestBed.runInInjectionContext(() => featureStore<Script[]>(TRANSITION_MODEL_KEY).value());
}

function editorStatus(harness: RouterTestingHarness): string | undefined {
  return harness.routeNativeElement?.querySelector('.editor-status')?.textContent?.trim();
}

function listItemCount(harness: RouterTestingHarness): number {
  return (
    harness.routeNativeElement?.querySelectorAll(
      'app-exercise-list mat-nav-list .exercise-list__item',
    ).length ?? 0
  );
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

  it('glosses "script" inline under the prompt on first use (#218)', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelector('.prompt-gloss')?.textContent?.trim()).toBe(
      'The pattern you learned at home; the book calls it a script.',
    );
  });

  it('shows no summary card and the gate checklist until the first item exists (#215)', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(host.querySelector('app-transition-summary')).toBeNull();
    expect(host.querySelector('app-done-toggle .done-checklist')?.textContent).toContain(
      'Add at least one pattern you learned at home',
    );

    await addScript(harness);
    harness.detectChanges();

    expect(host.querySelector('app-transition-summary')).not.toBeNull();
  });

  it('starts empty, with Mark done disabled', async () => {
    const harness = await setUp();
    const host = harness.routeNativeElement as HTMLElement;

    expect(
      host.querySelectorAll('app-exercise-list mat-nav-list .exercise-list__item'),
    ).toHaveLength(0);
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.getAttribute('aria-disabled') === 'true').toBe(true);
  });

  describe('draft before record (issue #217)', () => {
    it('Add opens the editor on a draft at `new`, stores nothing and reads "New"', async () => {
      const harness = await setUp();
      await openDraft(harness);

      expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
      expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).not.toBeNull();
      expect(editorStatus(harness)).toBe('New');
      expect(listItemCount(harness)).toBe(0);
      expect(storedScripts()).toHaveLength(0);
    });

    it('backing out of an untouched draft leaves no item and no record', async () => {
      const harness = await setUp();
      await openDraft(harness);
      await closeEditor(harness);

      expect(TestBed.inject(Router).url).toBe(LIST_URL);
      expect(listItemCount(harness)).toBe(0);
      expect(storedScripts()).toHaveLength(0);
    });

    it('choosing options alone keeps the draft in memory; they are kept once text saves it', async () => {
      const harness = await setUp();
      await openDraft(harness);

      itemForm(harness).changed.emit({ source: 'culture' });
      itemForm(harness).changed.emit({ text: '   ' });
      harness.detectChanges();
      expect(storedScripts()).toHaveLength(0);
      expect(editorStatus(harness)).toBe('New');

      itemForm(harness).changed.emit({ text: 'Silence means agreement' });
      harness.detectChanges();
      await harness.fixture.whenStable();

      const stored = storedScripts();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ text: 'Silence means agreement', source: 'culture' });
      expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${stored[0].id}`);
      expect(editorStatus(harness)).toBe('Saved');
      expect(listItemCount(harness)).toBe(1);
    });

    it('keeps the same form instance when the first keystroke moves the URL from `new` to the id', async () => {
      const harness = await setUp();
      await openDraft(harness);
      const form = itemForm(harness);

      form.changed.emit({ text: 'S' });
      harness.detectChanges();
      await harness.fixture.whenStable();

      expect(itemForm(harness)).toBe(form);
      form.changed.emit({ text: 'Si' });
      harness.detectChanges();
      expect(storedScripts()).toHaveLength(1);
      expect(storedScripts()[0].text).toBe('Si');
    });

    it('clearing the text after the first save keeps the saved script (no un-save)', async () => {
      const harness = await setUp();
      await addScript(harness, 'a');

      itemForm(harness).changed.emit({ text: '' });
      harness.detectChanges();

      expect(storedScripts()).toHaveLength(1);
      expect(storedScripts()[0].text).toBe('');
      expect(editorStatus(harness)).toBe('Saved');
    });

    it('a fresh navigation to `new` (a reload) opens an empty draft instead of redirecting', async () => {
      const harness = await setUp();
      await harness.navigateByUrl(`${LIST_URL}/new`);
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
      const textarea = harness.routeNativeElement?.querySelector(
        'app-transition-item-form textarea',
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
      expect(editorStatus(harness)).toBe('New');
    });

    it('a second Add after backing out starts from a fresh, empty draft', async () => {
      const harness = await setUp();
      await openDraft(harness);
      itemForm(harness).changed.emit({ source: 'culture' });
      await closeEditor(harness);
      await openDraft(harness);

      expect(itemForm(harness).script().source).toBe('family');
    });

    it("the form's delete button discards an unsaved draft without a confirm", async () => {
      const deleteWithUndo = fakeDeleteWithUndo();
      const harness = await setUp({ deleteWithUndo });
      await openDraft(harness);

      (
        harness.routeNativeElement!.querySelector(
          'app-transition-item-form .delete-button',
        ) as HTMLButtonElement
      ).click();
      await harness.fixture.whenStable();

      expect(deleteWithUndo.calls).toHaveLength(0);
      expect(TestBed.inject(Router).url).toBe(LIST_URL);
      expect(storedScripts()).toHaveLength(0);
    });

    it('the header Done button closes the editor', async () => {
      const harness = await setUp();
      await addScript(harness);

      (harness.routeNativeElement!.querySelector('.editor-done') as HTMLButtonElement).click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(LIST_URL);
      expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).toBeNull();
      expect(listItemCount(harness)).toBe(1);
    });
  });

  it('editing the text updates the list item and enables Mark done for a kept script', async () => {
    const harness = await setUp();
    await addScript(harness);
    const host = harness.routeNativeElement as HTMLElement;

    itemForm(harness).changed.emit({ text: 'Silence means agreement' });
    harness.detectChanges();

    expect(
      host.querySelector('app-exercise-list mat-nav-list .exercise-list__item')?.textContent,
    ).toContain('Silence means agreement');
    const markDone = host.querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone.getAttribute('aria-disabled') === 'true').toBe(false);
  });

  it('requires a new script and situation before Mark done is enabled once the decision is to stop it', async () => {
    const harness = await setUp();
    await addScript(harness);
    const host = harness.routeNativeElement as HTMLElement;

    itemForm(harness).changed.emit({ text: 'Silence means agreement', decision: 'stop' });
    harness.detectChanges();
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(true);

    itemForm(harness).changed.emit({ newScript: 'Pause and ask first' });
    harness.detectChanges();
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(true);

    itemForm(harness).changed.emit({ situation: "Tonight's dinner conversation" });
    harness.detectChanges();
    expect(
      (host.querySelector('app-done-toggle button') as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ) === 'true',
    ).toBe(false);
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

  it('deleting a script asks DeleteWithUndo to confirm, then closes the editor, returns to the list route, and removes it from the list, but keeps it counted', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp({ deleteWithUndo });
    await addScript(harness);

    (
      harness.routeNativeElement!.querySelector(
        'app-transition-item-form .delete-button',
      ) as HTMLButtonElement
    ).click();

    expect(deleteWithUndo.calls).toHaveLength(1);
    expect(deleteWithUndo.calls[0].deletedMessage).toBe('Script deleted');
    expect(deleteWithUndo.calls[0].undoLabel).toBe('Undo');

    // Simulates the user confirming in the (faked-away) dialog.
    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement as HTMLElement;

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(host.querySelector('app-transition-item-form')).toBeNull();
    expect(
      host.querySelectorAll('app-exercise-list mat-nav-list .exercise-list__item'),
    ).toHaveLength(0);
  });

  it('restores the deleted script when DeleteWithUndo reports Undo', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp({ deleteWithUndo });
    await addScript(harness);

    (
      harness.routeNativeElement!.querySelector(
        'app-transition-item-form .delete-button',
      ) as HTMLButtonElement
    ).click();
    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();

    deleteWithUndo.calls[0].onUndo();
    harness.detectChanges();
    await harness.navigateByUrl(LIST_URL);

    expect(
      harness.routeNativeElement?.querySelectorAll(
        'app-exercise-list mat-nav-list .exercise-list__item',
      ),
    ).toHaveLength(1);
  });

  it('deleting a script from its bin button in the list goes through the same DeleteWithUndo flow', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp({ deleteWithUndo });
    await addScript(harness);
    await closeEditor(harness);
    const host = harness.routeNativeElement as HTMLElement;

    (host.querySelector('.exercise-list__delete') as HTMLButtonElement).click();

    expect(deleteWithUndo.calls).toHaveLength(1);
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

  it('keeps the one page instance alive across opening and closing the editor (#187)', async () => {
    // The whole point of the single `optionalParamMatcher` route: with the earlier `''`/`':itemId'`
    // sibling pair, `RouteReuseStrategy` saw two different route configs and rebuilt the page —
    // and with it the kit's focus-restore state, the list's search text and the intro card's
    // collapsed state — on every open and every close.
    const harness = await setUp();
    const page = pageInstance(harness);

    await addScript(harness);
    expect(pageInstance(harness)).toBe(page);

    await closeEditor(harness);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(pageInstance(harness)).toBe(page);
  });

  it('focuses the script field when the editor opens and returns focus to the trigger when it closes', async () => {
    const harness = await setUp({ attached: true });
    const host = harness.routeNativeElement as HTMLElement;
    const addButton = host.querySelector('.add-button') as HTMLButtonElement;

    await addScript(harness);
    expect(document.activeElement).toBe(host.querySelector('app-transition-item-form textarea'));

    await closeEditor(harness);
    expect(document.activeElement).toBe(addButton);

    harness.fixture.nativeElement.remove();
  });

  it('keeps the intro card collapsed and the list search text after the editor closes', async () => {
    const harness = await setUp();
    // Search and sort only appear once the list is long enough to need them (#186).
    for (let i = 0; i < 6; i++) {
      await addScript(harness);
      await closeEditor(harness);
    }
    const host = harness.routeNativeElement as HTMLElement;
    const promptCard = harness.routeDebugElement!.query(By.directive(ExercisePromptCard))
      .componentInstance as ExercisePromptCard;
    const search = host.querySelector('app-exercise-list .search input') as HTMLInputElement;
    // Matches every row's subtitle, so there's still a row to open with the query in place.
    search.value = 'family';
    search.dispatchEvent(new Event('input'));
    harness.detectChanges();

    (
      host.querySelector('app-exercise-list mat-nav-list .exercise-list__item') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    await closeEditor(harness);

    // Entering focus mode collapses the intro; leaving it never re-expands (owner decision, #184).
    expect(promptCard.expanded()).toBe(false);
    expect(
      (
        harness.routeNativeElement!.querySelector(
          'app-exercise-list .search input',
        ) as HTMLInputElement
      ).value,
    ).toBe('family');
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

    const subtitleBefore = host.querySelector(
      'app-exercise-list mat-nav-list .exercise-list__item',
    )?.textContent;
    expect(subtitleBefore).toContain('Family');
    expect(subtitleBefore).toContain('Mixed');

    TestBed.inject(TranslocoService).setActiveLang('ar');
    harness.detectChanges();

    const subtitleAfter = host.querySelector(
      'app-exercise-list mat-nav-list .exercise-list__item',
    )?.textContent;
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

    expect(
      host.querySelectorAll('app-exercise-list mat-nav-list .exercise-list__item'),
    ).toHaveLength(1);
    expect(
      host.querySelector('app-exercise-list mat-nav-list .exercise-list__item')?.textContent,
    ).toContain('Silence means agreement');
  });
});

describe('TransitionPage intro card (issue #216)', () => {
  function promptCardIn(debugElement: DebugElement): ExercisePromptCard {
    return debugElement.query(By.directive(ExercisePromptCard)).componentInstance;
  }

  it('starts expanded on a first visit, before anything is saved (desktop)', async () => {
    const harness = await setUp();
    expect(promptCardIn(harness.fixture.debugElement).expanded()).toBe(true);
  });

  it('starts collapsed on a later visit once a live script exists (desktop)', async () => {
    await setUp();
    TestBed.runInInjectionContext(() =>
      featureStore<Script[]>(TRANSITION_MODEL_KEY).update((current) => [
        ...current,
        newRecord(
          {
            text: 'Silence means agreement',
            source: 'family',
            effect: 'harms',
            decision: 'keep',
          } as const,
          new Date('2026-01-01T00:00:00.000Z'),
        ),
      ]),
    );

    const fixture = TestBed.createComponent(TransitionPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(promptCardIn(fixture.debugElement).expanded()).toBe(false);
  });
});
