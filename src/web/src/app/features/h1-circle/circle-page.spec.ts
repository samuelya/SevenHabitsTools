import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { featureStore } from '../../core/data/feature-store';
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
import { CircleItemForm } from './circle-item-form';
import { CIRCLE_MODEL_KEY, CIRCLE_ROUTE, Concern, registerCircleModel } from './circle.model';
import circleRoutes from './circle.routes';

const LIST_URL = `/${CIRCLE_ROUTE}`;
/** Local noon, so the local date is 2026-02-26 in any test time zone. */
const NOW = new Date(2026, 1, 26, 12);

function testRoutes(): Routes {
  return [{ path: CIRCLE_ROUTE, children: circleRoutes }];
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
  registerCircleModel();
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

function itemForm(harness: RouterTestingHarness): CircleItemForm {
  return harness.routeDebugElement!.query(By.directive(CircleItemForm)).componentInstance;
}

function concerns(): Concern[] {
  return TestBed.runInInjectionContext(() => featureStore<Concern[]>(CIRCLE_MODEL_KEY).value());
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

/** Adds a concern the way a user does: open the draft, type, then any further fields. */
async function addConcern(
  harness: RouterTestingHarness,
  fields: Partial<Concern> = {},
): Promise<void> {
  await openDraft(harness);
  itemForm(harness).changed.emit({ title: 'The deadline keeps moving' });
  harness.detectChanges();
  await harness.fixture.whenStable();
  if (Object.keys(fields).length > 0) {
    itemForm(harness).changed.emit(fields);
    harness.detectChanges();
    await harness.fixture.whenStable();
  }
}

function markDone(harness: RouterTestingHarness): HTMLButtonElement {
  return host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
}

function headings(harness: RouterTestingHarness): string[] {
  return [...host(harness).querySelectorAll('.group-heading')].map(
    (h) => h.textContent?.trim() ?? '',
  );
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

describe('CirclePage', () => {
  it('renders the long title, the prompt and the gloss', async () => {
    const harness = await setUp();

    expect(host(harness).textContent).toContain('Sort what you can change');
    expect(host(harness).querySelector('.prompt-gloss')?.textContent).toContain(
      'Circle of Influence',
    );
  });

  it('shows one empty state, no group heading, no summary and the gate checklist', async () => {
    const harness = await setUp();

    expect(host(harness).querySelectorAll('app-exercise-list')).toHaveLength(1);
    expect(host(harness).textContent).toContain('Nothing here yet.');
    expect(headings(harness)).toEqual([]);
    expect(host(harness).querySelector('app-circle-summary')).toBeNull();
    expect(host(harness).querySelector('app-done-toggle .done-checklist')?.textContent).toContain(
      "Add something that's on your mind",
    );
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');
  });

  it('Add opens a draft that stores nothing until the first typed character', async () => {
    const harness = await setUp();

    await openDraft(harness);
    itemForm(harness).changed.emit({ control: 'none' });
    harness.detectChanges();
    expect(concerns()).toEqual([]);

    itemForm(harness).changed.emit({ title: 'B' });
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(concerns()).toHaveLength(1);
    expect(concerns()[0].control).toBe('none');
  });

  it('groups concerns under their headings, affectable first, and hides an empty group', async () => {
    const harness = await setUp();

    await addConcern(harness, { control: 'none' });
    expect(headings(harness)).toEqual(["Things you can't control"]);

    await addConcern(harness, { control: 'indirect' });
    expect(headings(harness)).toEqual(['Things you can affect', "Things you can't control"]);
    expect(host(harness).querySelectorAll('app-exercise-list')).toHaveLength(2);
    expect(host(harness).querySelector('app-exercise-list input[type="search"]')).toBeNull();
    expect(host(harness).querySelector('.group')?.textContent).toContain('Up to others too · Open');
  });

  it('shows the summary over branch A concerns', async () => {
    const harness = await setUp();

    await addConcern(harness, { firstStep: 'Ask' });
    await addConcern(harness, { control: 'indirect' });
    expect(host(harness).querySelector('app-circle-summary')?.textContent).toContain(
      '1 of 2 has a first step',
    );
  });

  it('enables Mark done once a concern has a step taken', async () => {
    const harness = await setUp();

    await addConcern(harness, { firstStep: 'Ask' });
    expect(markDone(harness).getAttribute('aria-disabled')).toBe('true');

    itemForm(harness).changed.emit({ status: 'stepTaken' });
    harness.detectChanges();
    expect(markDone(harness).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('makes a promise from the first step and shows its status without changing the concern', async () => {
    const harness = await setUp();
    await addConcern(harness, { firstStep: 'Ask for a chat', dueDate: '2026-03-05' });
    const id = concerns()[0].id;

    (host(harness).querySelector('.make-promise-button') as HTMLButtonElement).click();
    harness.detectChanges();

    const [promise] = promises();
    expect(promise).toMatchObject({
      text: 'Ask for a chat',
      toWhom: 'self',
      dueDate: '2026-03-05',
      status: 'open',
      source: { exerciseId: 'h1-circle', recordId: id },
    });
    expect(concerns()[0].commitmentId).toBe(promise.id);
    expect(host(harness).querySelector('.make-promise-button')).toBeNull();
    expect(host(harness).querySelector('.promise-status')?.textContent).toContain('Promise: Open');

    TestBed.inject(CommitmentsService).setStatus(promise.id, 'kept');
    harness.detectChanges();
    expect(host(harness).querySelector('.promise-status')?.textContent).toContain('Promise: Kept');
    expect(concerns()[0].status).toBe('open');
  });

  it('"Try this example" adds a sample, due a week from today, and opens it', async () => {
    const harness = await setUp();
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));

    (card.componentInstance as ExercisePromptCard).exampleTried.emit({
      title: 'My manager keeps changing the deadline.',
      control: 'indirect',
      firstStep: 'Ask for a 10-minute chat about how deadlines get set.',
    });
    await harness.fixture.whenStable();

    expect(concerns()).toHaveLength(1);
    expect(concerns()[0]).toMatchObject({ sample: true, status: 'open', dueDate: '2026-03-05' });
    expect(harness.routeNativeElement?.querySelector('app-circle-item-form')).not.toBeNull();
    // A sample alone doesn't start the exercise: no summary.
    expect(host(harness).querySelector('app-circle-summary')).toBeNull();
  });

  it('deleting asks DeleteWithUndo, then tombstones the concern', async () => {
    const deleteWithUndo = fakeDeleteWithUndo();
    const harness = await setUp(deleteWithUndo);
    await addConcern(harness);

    (
      host(harness).querySelector('app-circle-item-form .delete-button') as HTMLButtonElement
    ).click();
    expect(deleteWithUndo.calls[0].deletedMessage).toBe('Concern deleted');

    deleteWithUndo.calls[0].onConfirm();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(concerns()[0].deletedAt).toBeDefined();
    expect(host(harness).textContent).toContain('Nothing here yet.');
  });
});
