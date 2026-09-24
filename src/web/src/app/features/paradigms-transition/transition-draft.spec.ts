import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { WriterRole } from '../../core/data/multi-tab/writer-role-state';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { TransitionItemForm } from './transition-item-form';
import {
  registerTransitionModel,
  Script,
  TRANSITION_MODEL_KEY,
  TRANSITION_ROUTE,
} from './transition.model';
import transitionRoutes from './transition.routes';

/** Draft before record (issue #217), apart from `transition-page.spec.ts` to keep both files under
 * the 500-line rule. Same harness: the feature mounted at its real `TRANSITION_ROUTE`. */
const LIST_URL = `/${TRANSITION_ROUTE}`;

/** Captures confirm/delete calls instead of opening a dialog (`transition-page.spec.ts`'s fake). */
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
  options: { deleteWithUndo?: ReturnType<typeof fakeDeleteWithUndo>; role?: WriterRole } = {},
): Promise<RouterTestingHarness> {
  registerExerciseKitModel();
  registerTransitionModel();
  const role = options.role ?? 'writer';
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
      { provide: DeleteWithUndo, useValue: options.deleteWithUndo ?? fakeDeleteWithUndo() },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

async function closeEditor(harness: RouterTestingHarness): Promise<void> {
  (harness.routeNativeElement!.querySelector('.editor-close') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

/** Taps "Add a script": opens the editor on an in-memory draft at `new`. */
async function openDraft(harness: RouterTestingHarness): Promise<void> {
  (harness.routeNativeElement!.querySelector('.add-button') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

/** Opens a draft and types its text, which saves it. */
async function addScript(harness: RouterTestingHarness, text: string): Promise<void> {
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

describe('TransitionPage draft before record (issue #217)', () => {
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
    await addScript(harness, 'Silence means agreement');

    (harness.routeNativeElement!.querySelector('.editor-done') as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).toBeNull();
    expect(listItemCount(harness)).toBe(1);
  });
  it('typed text in any free-text field saves the draft, not just the script', async () => {
    const harness = await setUp();
    await openDraft(harness);

    itemForm(harness).changed.emit({ situation: 'Team meetings' });
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(storedScripts()).toHaveLength(1);
    expect(storedScripts()[0]).toMatchObject({ text: '', situation: 'Team meetings' });
    expect(editorStatus(harness)).toBe('Saved');
  });

  it('Add while a draft is open starts a fresh one', async () => {
    const harness = await setUp();
    await openDraft(harness);
    const firstId = itemForm(harness).script().id;
    itemForm(harness).changed.emit({ source: 'culture' });
    harness.detectChanges();

    await openDraft(harness);

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    expect(itemForm(harness).script().id).not.toBe(firstId);
    expect(itemForm(harness).script().source).toBe('family');
    expect(storedScripts()).toHaveLength(0);
  });

  it('opens no draft in a read-only tab, and counts it as a refused edit', async () => {
    const harness = await setUp({ role: 'reader' });
    await openDraft(harness);

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).toBeNull();
    expect(TestBed.inject(DocumentStore).refusedEdits()).toBe(1);
  });

  it('a reload on `new` in a read-only tab returns to the list', async () => {
    const harness = await setUp({ role: 'reader' });
    await harness.navigateByUrl(`${LIST_URL}/new`);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(harness.routeNativeElement?.querySelector('app-transition-item-form')).toBeNull();
  });
});
