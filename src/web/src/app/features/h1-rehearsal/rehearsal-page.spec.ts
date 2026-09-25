import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { featureStore } from '../../core/data/feature-store';
import { getRegisteredModels } from '../../core/data/registry';
import { CLOCK } from '../../core/time/clock';
// Side-effect only: `DoneToggle`'s caption and the date adapter read `settings` via `featureStore`.
import '../../features/settings/settings.model';
import { CommitmentsService } from '../../shared/commitments/commitments.service';
import {
  COMMITMENTS_MODEL_KEY,
  Commitment,
  registerCommitmentsModel,
} from '../../shared/commitments/commitments.model';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { RehearsalItemForm } from './rehearsal-item-form';
import {
  REHEARSAL_MODEL_KEY,
  REHEARSAL_ROUTE,
  Rehearsal,
  RehearsalFields,
  registerRehearsalModel,
} from './rehearsal.model';
import rehearsalRoutes from './rehearsal.routes';

const LIST_URL = `/${REHEARSAL_ROUTE}`;
/** Local noon, so the local date is 2026-02-26 in any test time zone. */
const NOW = new Date(2026, 1, 26, 12);

function testRoutes(): Routes {
  return [{ path: REHEARSAL_ROUTE, children: rehearsalRoutes }];
}

function fakeDeleteWithUndo() {
  const calls: ConfirmAndDeleteOptions[] = [];
  return {
    calls,
    confirmAndDelete: vi.fn(async (options: ConfirmAndDeleteOptions) => {
      calls.push(options);
    }),
  };
}

async function setUp(deleteWithUndo = fakeDeleteWithUndo()): Promise<RouterTestingHarness> {
  // Vitest runs with `isolate: false`: re-assert registrations instead of resetting them.
  registerExerciseKitModel();
  registerCommitmentsModel();
  registerRehearsalModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => NOW } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: DeleteWithUndo, useValue: deleteWithUndo },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function itemForm(harness: RouterTestingHarness): RehearsalItemForm {
  return harness.routeDebugElement!.query(By.directive(RehearsalItemForm)).componentInstance;
}

function rehearsals(): Rehearsal[] {
  return TestBed.runInInjectionContext(() =>
    featureStore<Rehearsal[]>(REHEARSAL_MODEL_KEY).value(),
  );
}

function promises(): Commitment[] {
  return TestBed.runInInjectionContext(() =>
    featureStore<Commitment[]>(COMMITMENTS_MODEL_KEY).value(),
  );
}

async function openDraft(harness: RouterTestingHarness): Promise<void> {
  const add = host(harness).querySelector('.add-button') as HTMLButtonElement;
  add.focus();
  add.click();
  await harness.fixture.whenStable();
}

/** Adds a rehearsal the way a user does: open the draft, type, then any further fields. */
async function addRehearsal(
  harness: RouterTestingHarness,
  fields: Partial<RehearsalFields> = {},
): Promise<string> {
  await openDraft(harness);
  await emit(harness, { trigger: 'Sunday lunch' });
  if (Object.keys(fields).length > 0) {
    await emit(harness, fields);
  }
  return rehearsals()[rehearsals().length - 1].id;
}

async function emit(
  harness: RouterTestingHarness,
  fields: Partial<RehearsalFields>,
): Promise<void> {
  itemForm(harness).changed.emit(fields);
  harness.detectChanges();
  await harness.fixture.whenStable();
}

function markDone(harness: RouterTestingHarness): HTMLButtonElement {
  return host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
}

function rowSubtitles(harness: RouterTestingHarness): string[] {
  return [...host(harness).querySelectorAll('.exercise-list__item')].map(
    (row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

const SCENE = 'I take a breath and say: "Ask me one question and I will answer it properly."';
const COMPLETE: Partial<RehearsalFields> = {
  expectedOn: '2026-03-01',
  usualReaction: 'I get short with him.',
  cost: 'The afternoon is ruined.',
  chosenResponse: SCENE,
  promise: 'Answer calmly.',
};

describe('RehearsalPage', () => {
  it('renders the long title, the prompt and the gloss', async () => {
    const harness = await setUp();

    expect(host(harness).textContent).toContain('Rehearse your next hard moment');
    expect(host(harness).querySelector('.prompt-gloss')?.textContent).toContain('stimulus');
  });

  it('shows the empty state, no summary and the gate checklist', async () => {
    const harness = await setUp();

    expect(host(harness).textContent).toContain('Nothing rehearsed yet.');
    expect(host(harness).querySelector('app-rehearsal-summary')).toBeNull();
    expect(host(harness).querySelector('app-done-toggle .done-checklist')?.textContent).toContain(
      "Name a moment that's coming up",
    );
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');
  });

  it('Add opens a draft that stores nothing until the first typed character', async () => {
    const harness = await setUp();

    await openDraft(harness);
    await emit(harness, { expectedOn: '2026-03-01' });
    expect(rehearsals()).toEqual([]);

    await emit(harness, { trigger: 'S' });
    expect(rehearsals()).toHaveLength(1);
    expect(rehearsals()[0].expectedOn).toBe('2026-03-01');
  });

  it('a date cleared on the draft never reaches storage', async () => {
    const harness = await setUp();

    await openDraft(harness);
    await emit(harness, { expectedOn: '2026-03-05' });
    await emit(harness, { expectedOn: '' });
    await emit(harness, { trigger: 'S' });

    const [stored] = rehearsals();
    expect(stored.expectedOn).toBeUndefined();
    const model = getRegisteredModels().find((entry) => entry.key === REHEARSAL_MODEL_KEY)!;
    expect(model.validate?.(rehearsals())).toBe(true);
  });

  it('a date cleared on a stored rehearsal is removed', async () => {
    const harness = await setUp();
    await addRehearsal(harness, { expectedOn: '2026-03-05' });

    await emit(harness, { expectedOn: '' });
    expect('expectedOn' in rehearsals()[0]).toBe(false);
  });

  it('lists rehearsals soonest first, with the date and row status', async () => {
    const harness = await setUp();
    await addRehearsal(harness, { expectedOn: '2026-03-10' });
    await addRehearsal(harness, { expectedOn: '2026-02-20' });
    await addRehearsal(harness);

    const rows = rowSubtitles(harness);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Ready to follow up');
    expect(rows[1]).toContain('Planned');
    expect(rows[1]).toMatch(/Mar 10, 2026/);
    expect(rows[2]).toContain('Planned');
  });

  it('makes a promise once the line and date are set, then keeps it in step', async () => {
    const harness = await setUp();
    const id = await addRehearsal(harness, { promise: 'Answer calmly.' });
    expect(promises()).toEqual([]);

    await emit(harness, { expectedOn: '2026-03-01' });
    const [promise] = promises();
    expect(promise).toMatchObject({
      text: 'Answer calmly.',
      toWhom: 'self',
      dueDate: '2026-03-01',
      status: 'open',
      source: { exerciseId: 'h1-rehearsal', recordId: id },
    });
    expect(rehearsals()[0].commitmentId).toBe(promise.id);
    expect(host(harness).querySelector('.promise-status')?.textContent).toContain('Promise: Open');

    await emit(harness, { promise: 'Answer calmly, then ask.' });
    await emit(harness, { expectedOn: '2026-03-02' });
    expect(promises()).toHaveLength(1);
    expect(promises()[0]).toMatchObject({
      text: 'Answer calmly, then ask.',
      dueDate: '2026-03-02',
    });
  });

  it('does not edit a promise once it is resolved', async () => {
    const harness = await setUp();
    await addRehearsal(harness, { promise: 'Answer calmly.', expectedOn: '2026-03-01' });
    TestBed.inject(CommitmentsService).setStatus(promises()[0].id, 'kept');

    await emit(harness, { promise: 'Something else' });
    expect(promises()[0]).toMatchObject({ text: 'Answer calmly.', status: 'kept' });
    expect(host(harness).querySelector('.promise-status')?.textContent).toContain('Promise: Kept');
  });

  it('enables Mark done for a complete rehearsal, without a follow-up', async () => {
    const harness = await setUp();
    await addRehearsal(harness, { ...COMPLETE, chosenResponse: 'Too short.' });
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');

    await emit(harness, { chosenResponse: SCENE });
    expect(markDone(harness).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('shows Afterwards once the date has come, and its Save resolves the promise', async () => {
    const harness = await setUp();
    const id = await addRehearsal(harness, { ...COMPLETE });
    expect(host(harness).querySelector('app-rehearsal-follow-up')).toBeNull();

    await emit(harness, { expectedOn: '2026-02-26' });
    expect(host(harness).querySelector('app-rehearsal-follow-up')).not.toBeNull();
    expect(promises()[0].status).toBe('open');

    const followUp = harness.routeDebugElement!.query(By.css('app-rehearsal-follow-up'));
    followUp.componentInstance.saved.emit({ happened: true, result: 'chosen', kept: 'kept' });
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(rehearsals()[0].followUp).toEqual({ happened: true, result: 'chosen', kept: 'kept' });
    expect(promises()[0]).toMatchObject({ status: 'kept', resolvedOn: '2026-02-26' });
    expect(rowSubtitles(harness)[0]).toContain('Followed up');
    expect(host(harness).querySelector('app-rehearsal-summary')?.textContent).toContain(
      '1 of 1 went as planned',
    );
    expect(rehearsals()[0].id).toBe(id);
  });

  it('"Try this example" adds a sample with no date and no promise, and opens it', async () => {
    const harness = await setUp();
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));

    (card.componentInstance as ExercisePromptCard).exampleTried.emit({
      trigger: 'Sunday lunch, when Dad brings up my job again.',
      usualReaction: 'I get short with him.',
      cost: 'Ruined.',
      chosenResponse: SCENE,
      promise: 'Answer calmly.',
    });
    await harness.fixture.whenStable();

    expect(rehearsals()).toHaveLength(1);
    expect(rehearsals()[0]).toMatchObject({ sample: true });
    expect(rehearsals()[0].expectedOn).toBeUndefined();
    expect(promises()).toEqual([]);
    expect(host(harness).querySelector('app-rehearsal-item-form')).not.toBeNull();
    expect(host(harness).querySelector('app-rehearsal-summary')).toBeNull();

    // Picking a date makes it the user's own, which then makes the promise.
    await emit(harness, { expectedOn: '2026-03-01' });
    expect(rehearsals()[0].sample).toBeUndefined();
    expect(promises()).toHaveLength(1);
  });

  it('deleting asks DeleteWithUndo, then tombstones the rehearsal', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp(deleteWithUndo);
    await addRehearsal(harness);

    (
      host(harness).querySelector('app-rehearsal-item-form .delete-button') as HTMLButtonElement
    ).click();
    expect(deleteWithUndo.calls[0].deletedMessage).toBe('Rehearsal deleted');

    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(rehearsals()[0].deletedAt).toBeDefined();
    expect(host(harness).textContent).toContain('Nothing rehearsed yet.');
  });
});
