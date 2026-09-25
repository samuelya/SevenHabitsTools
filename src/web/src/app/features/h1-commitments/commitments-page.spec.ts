import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { DocumentStore } from '../../core/data/document.store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { Commitment, registerCommitmentsModel } from '../../shared/commitments/commitments.model';
import { CommitmentsService } from '../../shared/commitments/commitments.service';
import {
  ConfirmAndDeleteOptions,
  DeleteWithUndo,
} from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { registerTransitionModel } from '../paradigms-transition/transition.model';
import { CommitmentsItemForm } from './commitments-item-form';
import { H1_COMMITMENTS_ROUTE, registerCommitmentsExercise } from './commitments.model';
import commitmentsRoutes from './commitments.routes';

const LIST_URL = `/${H1_COMMITMENTS_ROUTE}`;
/** Local 10:00 on 2026-03-10: "today" is 2026-03-10 in any timezone. */
const NOW = new Date(2026, 2, 10, 10, 0, 0);

function testRoutes(): Routes {
  return [{ path: H1_COMMITMENTS_ROUTE, children: commitmentsRoutes }];
}

interface Setup {
  harness: RouterTestingHarness;
  service: CommitmentsService;
  deletes: ConfirmAndDeleteOptions[];
}

async function setUp(seed: Commitment[] = [], url = LIST_URL): Promise<Setup> {
  registerExerciseKitModel();
  registerCommitmentsModel();
  registerCommitmentsExercise();
  // A second registered exercise, so a promise can name a real source.
  registerTransitionModel();
  const deletes: ConfirmAndDeleteOptions[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => NOW } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      {
        provide: DeleteWithUndo,
        useValue: {
          confirmAndDelete: vi.fn(async (options: ConfirmAndDeleteOptions) => {
            deletes.push(options);
          }),
        },
      },
    ],
  });
  const service = TestBed.inject(CommitmentsService);
  seed.forEach((record) => service.insert(record));
  const harness = await RouterTestingHarness.create(url);
  return { harness, service, deletes };
}

function promise(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: overrides.id ?? 'c1',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    text: 'Call Mum on Sunday afternoon.',
    toWhom: 'self',
    status: 'open',
    ...overrides,
  };
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function form(harness: RouterTestingHarness): CommitmentsItemForm {
  return harness.routeDebugElement!.query(By.directive(CommitmentsItemForm)).componentInstance;
}

async function settle(harness: RouterTestingHarness): Promise<void> {
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}

function rows(harness: RouterTestingHarness): string[] {
  return [...host(harness).querySelectorAll('.exercise-list__item [matListItemTitle]')].map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function markDoneButton(harness: RouterTestingHarness): HTMLButtonElement {
  return host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
}

describe('CommitmentsPage', () => {
  it('renders the long title, the prompt and the gloss', async () => {
    const { harness } = await setUp();
    expect(host(harness).textContent).toContain('Make small promises and keep them');
    expect(host(harness).textContent).toContain('Small promises, kept, add up.');
    expect(host(harness).textContent).toContain('builds what it calls integrity');
    expect(host(harness).textContent).toContain('No promises yet.');
  });

  it('creates the record on the first typed character, not on Add (#217)', async () => {
    const { harness, service } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    expect(service.all()).toEqual([]);

    form(harness).changed.emit({ text: 'C' });
    await settle(harness);
    expect(service.all()).toHaveLength(1);
    expect(service.all()[0]).toMatchObject({ text: 'C', status: 'open', toWhom: 'self' });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${service.all()[0].id}`);
  });

  it('leaves nothing behind when an untouched draft is closed', async () => {
    const { harness } = await setUp();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await settle(harness);
    form(harness).changed.emit({ toWhom: 'other' });
    await settle(harness);
    await TestBed.inject(Router).navigateByUrl(LIST_URL);
    await settle(harness);
    const doc = TestBed.inject(DocumentStore).document() as unknown as {
      shared: { commitments?: unknown[] };
    };
    expect(doc.shared.commitments ?? []).toEqual([]);
  });

  it('keeps, then reopens, a promise from the editor, and gates Mark done on Kept', async () => {
    const { harness, service } = await setUp(
      [promise({ dueDate: '2026-03-12' })],
      `${LIST_URL}/c1`,
    );
    await settle(harness);
    expect(markDoneButton(harness).getAttribute('aria-disabled')).toBe('true');
    expect(host(harness).textContent).toContain('Keep it, then mark it Kept');

    form(harness).resolved.emit('kept');
    await settle(harness);
    expect(service.byId('c1')()).toMatchObject({ status: 'kept', resolvedOn: '2026-03-10' });
    expect(markDoneButton(harness).getAttribute('aria-disabled')).not.toBe('true');
    expect(host(harness).querySelector('app-commitments-summary')?.textContent).toContain(
      'All time: kept 1 of 1 (100%)',
    );

    form(harness).reopened.emit();
    await settle(harness);
    expect(service.byId('c1')()?.status).toBe('open');
    expect(service.byId('c1')()?.resolvedOn).toBeUndefined();
    expect(host(harness).querySelector('app-commitments-summary')).toBeNull();
  });

  it('shows the repair note field once Broken, and stores the note', async () => {
    const { harness, service } = await setUp([promise()], `${LIST_URL}/c1`);
    await settle(harness);
    expect(host(harness).textContent).not.toContain('What got in the way');
    form(harness).resolved.emit('broken');
    await settle(harness);
    expect(host(harness).textContent).toContain('What got in the way');
    form(harness).changed.emit({ repairNote: 'Too big.' });
    await settle(harness);
    expect(service.byId('c1')()?.repairNote).toBe('Too big.');
  });

  it('filters the list and shows the From filter only with a sourced promise', async () => {
    const { harness } = await setUp([
      promise({ id: 'a', text: 'Overdue one', dueDate: '2026-03-01' }),
      promise({ id: 'b', text: 'Due today', dueDate: '2026-03-10' }),
      promise({ id: 'c', text: 'Kept one', status: 'kept', resolvedOn: '2026-03-09' }),
    ]);
    await settle(harness);
    expect(host(harness).querySelectorAll('mat-chip-listbox')).toHaveLength(1);
    expect(rows(harness)).toHaveLength(3);
    // Overdue: the warning row reads "Overdue: " first, visually hidden.
    const overdue = host(harness).querySelector('.exercise-list__item--warning');
    expect(overdue?.querySelector('.visually-hidden')?.textContent).toContain('Overdue');

    const chip = (label: string) =>
      [...host(harness).querySelectorAll('mat-chip-option')].find((el) =>
        el.textContent?.includes(label),
      ) as HTMLElement;
    (chip('Due today').querySelector('button') as HTMLButtonElement).click();
    await settle(harness);
    expect(rows(harness)).toEqual(['Due today']);
    (chip('Kept').querySelector('button') as HTMLButtonElement).click();
    await settle(harness);
    expect(rows(harness)).toEqual(['Kept one']);
  });

  it('shows a source line that links to the exercise, and a From filter', async () => {
    const { harness } = await setUp(
      [
        promise({ id: 'a', source: { exerciseId: 'paradigms-transition' } }),
        promise({ id: 'b', text: 'Mine' }),
      ],
      `${LIST_URL}/a`,
    );
    await settle(harness);
    expect(host(harness).querySelectorAll('mat-chip-listbox')).toHaveLength(2);
    expect(host(harness).textContent).toContain('From: Transition person');
    const link = host(harness).querySelector('.source-line') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/habits/paradigms/transition');
  });

  it('"Try this example" adds an open sample due in three days', async () => {
    const { harness, service } = await setUp();
    const card = harness.routeDebugElement!.query(By.directive(ExercisePromptCard));
    (card.componentInstance as ExercisePromptCard).exampleTried.emit({
      text: 'Call Mum on Sunday afternoon.',
      toWhom: 'self',
    });
    await settle(harness);
    expect(service.all()).toHaveLength(1);
    expect(service.all()[0]).toMatchObject({ sample: true, status: 'open', dueDate: '2026-03-13' });
    expect(host(harness).querySelector('app-commitments-summary')).toBeNull();
  });

  it('deletes with undo through the service', async () => {
    const { harness, service, deletes } = await setUp([promise()]);
    await settle(harness);
    (host(harness).querySelector('.exercise-list__delete') as HTMLButtonElement).click();
    await settle(harness);
    deletes[0].onConfirm();
    expect(service.all()).toEqual([]);
    deletes[0].onUndo();
    expect(service.all()).toHaveLength(1);
  });

  it('follows a language switch', async () => {
    const { harness } = await setUp([promise({ status: 'kept', resolvedOn: '2026-03-10' })]);
    await settle(harness);
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await settle(harness);
    expect(host(harness).textContent).toContain('تم الوفاء');
    TestBed.inject(TranslocoService).setActiveLang('en');
  });
});
