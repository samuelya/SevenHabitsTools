import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { newLongViewFields } from './long-view.logic';
import {
  LONG_VIEW_MODEL_KEY,
  LONG_VIEW_ROUTE,
  LongView,
  LongViewScenario,
  registerLongViewModel,
} from './long-view.model';
import longViewRoutes from './long-view.routes';

const LIST_URL = `/${LONG_VIEW_ROUTE}`;
const NOW = '2026-09-26T09:00:00.000Z';

function testRoutes(): Routes {
  return [{ path: LONG_VIEW_ROUTE, children: longViewRoutes }];
}

async function setUp(): Promise<RouterTestingHarness> {
  // Vitest here runs with `isolate: false` (shared module state) — see `exercise-kit.model.spec.ts`.
  registerExerciseKitModel();
  registerLongViewModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(testRoutes(), withComponentInputBinding()),
      { provide: CLOCK, useValue: { now: () => new Date(NOW) } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
      { provide: DeleteWithUndo, useValue: { confirmAndDelete: vi.fn(async () => undefined) } },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function stored(): readonly LongView[] {
  return TestBed.runInInjectionContext(() => featureStore<LongView[]>(LONG_VIEW_MODEL_KEY).value());
}

function seed(...views: LongView[]): void {
  TestBed.runInInjectionContext(() =>
    featureStore<LongView[]>(LONG_VIEW_MODEL_KEY).update((current) => [...current, ...views]),
  );
}

function completeView(
  id: string,
  scenario: LongViewScenario,
  values: string[],
  date = '2026-09-20',
): LongView {
  const fields = newLongViewFields(scenario, date);
  return {
    id,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    ...fields,
    answers: fields.answers.map((answer, index) => ({
      ...answer,
      text: 'Said something.',
      values: index === 0 ? values : [],
    })),
  };
}

async function openNew(harness: RouterTestingHarness): Promise<void> {
  (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
  await harness.fixture.whenStable();
}

async function pick(harness: RouterTestingHarness, index: number): Promise<void> {
  const cards = host(harness).querySelectorAll<HTMLButtonElement>('.scenario-card');
  cards[index].click();
  await harness.fixture.whenStable();
}

async function type(harness: RouterTestingHarness, element: Element, value: string): Promise<void> {
  const field = element as HTMLInputElement | HTMLTextAreaElement;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  await harness.fixture.whenStable();
}

function answerFields(harness: RouterTestingHarness): HTMLTextAreaElement[] {
  return [...host(harness).querySelectorAll<HTMLTextAreaElement>('app-long-view-prompt textarea')];
}

describe('LongViewPage (issue #58)', () => {
  it('renders the long title and the gloss', async () => {
    const harness = await setUp();
    expect(host(harness).textContent).toContain('Look back from the end');
    expect(host(harness).querySelector('.prompt-gloss')?.textContent).toContain(
      'begin with the end in mind',
    );
  });

  it('New long view opens the four-card picker at `new` and stores nothing', async () => {
    const harness = await setUp();
    await openNew(harness);

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    const titles = [...host(harness).querySelectorAll('.scenario-card .title')].map((title) =>
      title.textContent?.trim(),
    );
    expect(titles).toEqual([
      'Your funeral',
      'One year left',
      'A milestone anniversary',
      'Your last day at work',
    ]);
    expect(stored()).toHaveLength(0);
  });

  it('picking a scenario opens its prompts; the choice alone stores nothing', async () => {
    const harness = await setUp();
    await openNew(harness);
    await pick(harness, 1);

    expect(host(harness).querySelector('.scenario-card')).toBeNull();
    expect(answerFields(harness)).toHaveLength(3);
    expect(host(harness).textContent).toContain('Who would you spend the year with, and how?');
    expect(stored()).toHaveLength(0);

    (host(harness).querySelector('.editor-close') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(stored()).toHaveLength(0);
  });

  it('stores the record on the first typed character and stays in the editor', async () => {
    const harness = await setUp();
    await openNew(harness);
    await pick(harness, 0);
    await type(harness, answerFields(harness)[0], 'H');

    const [view] = stored();
    expect(view.scenario).toBe('funeral');
    expect(view.date).toBe('2026-09-26');
    expect(view.answers[0].text).toBe('H');
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${view.id}`);
    expect(answerFields(harness)).toHaveLength(4);
  });

  it('pre-sets the funeral speaker to the slot label and stores an edit of it', async () => {
    const harness = await setUp();
    await openNew(harness);
    await pick(harness, 0);
    const speaker = host(harness).querySelector<HTMLInputElement>(
      'app-long-view-prompt input[type="text"]',
    );
    expect(speaker?.value).toBe('Family');

    await type(harness, speaker!, 'Mum');
    expect(stored()[0].answers[0].speaker).toBe('Mum');

    await type(harness, speaker!, '  ');
    expect(stored()[0].answers[0].speaker).toBeUndefined();
    expect(speaker?.value).toBe('  ');
    speaker!.dispatchEvent(new Event('blur'));
    await harness.fixture.whenStable();
    expect(speaker?.value).toBe('Family');
  });

  it('shows a cleared speaker as the slot label in the readout too', async () => {
    const harness = await setUp();
    const view = completeView('lv1', 'funeral', ['family']);
    seed({
      ...view,
      answers: view.answers.map((answer, index) =>
        index === 0 ? { ...answer, speaker: ' ' } : answer,
      ),
    });
    await harness.navigateByUrl(`${LIST_URL}/lv1`);

    const titles = [...host(harness).querySelectorAll('app-long-view-readout .answer-title')];
    expect(titles[0].textContent?.trim()).toBe('Family');

    (host(harness).querySelector('app-long-view-readout button') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(
      host(harness).querySelector<HTMLInputElement>('app-long-view-prompt input[type="text"]')
        ?.value,
    ).toBe('Family');
  });

  it('adds a trimmed value chip, once, and removes it', async () => {
    const harness = await setUp();
    await openNew(harness);
    await pick(harness, 3);
    const chipInput = host(harness).querySelector<HTMLInputElement>('.mat-mdc-chip-input')!;

    chipInput.value = '  presence ';
    chipInput.dispatchEvent(new Event('blur'));
    await harness.fixture.whenStable();
    expect(stored()[0].answers[0].values).toEqual(['presence']);

    chipInput.value = 'Presence';
    chipInput.dispatchEvent(new Event('blur'));
    await harness.fixture.whenStable();
    expect(stored()[0].answers[0].values).toEqual(['presence']);
    expect(chipInput.value).toBe('Presence');
    expect(host(harness).querySelector('.duplicate-hint')?.textContent).toContain(
      '“Presence” is already here.',
    );

    chipInput.value = 'Presencex';
    chipInput.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(host(harness).querySelector('.duplicate-hint')?.textContent?.trim()).toBe('');

    (host(harness).querySelector('.mat-mdc-chip-remove') as HTMLElement).click();
    await harness.fixture.whenStable();
    expect(stored()[0].answers[0].values).toEqual([]);
  });

  it('opens a saved long view read-only, with Edit and Redo', async () => {
    const harness = await setUp();
    seed(completeView('lv1', 'oneYear', ['family']));
    await harness.navigateByUrl(`${LIST_URL}/lv1`);

    expect(host(harness).querySelector('app-long-view-readout')).not.toBeNull();
    expect(answerFields(harness)).toHaveLength(0);

    (host(harness).querySelector('app-long-view-readout button') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(answerFields(harness)).toHaveLength(3);
  });

  it('Redo starts a new record of the same scenario and keeps the old one', async () => {
    const harness = await setUp();
    seed(completeView('lv1', 'anniversary', ['trust']));
    await harness.navigateByUrl(`${LIST_URL}/lv1`);

    const buttons = host(harness).querySelectorAll<HTMLButtonElement>(
      'app-long-view-readout .actions button',
    );
    buttons[1].click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    expect(host(harness).querySelector('.scenario-card')).toBeNull();
    await type(harness, answerFields(harness)[0], 'Our 30th.');

    const views = stored();
    expect(views).toHaveLength(2);
    expect(views[1].scenario).toBe('anniversary');
    expect(views[0].answers[0].text).toBe('Said something.');
  });

  it('opens the picker on a draft recreated by Back/Forward after a Redo', async () => {
    const harness = await setUp();
    seed(completeView('lv1', 'anniversary', ['trust']));
    await harness.navigateByUrl(`${LIST_URL}/lv1`);
    host(harness)
      .querySelectorAll<HTMLButtonElement>('app-long-view-readout .actions button')[1]
      .click();
    await harness.fixture.whenStable();
    expect(host(harness).querySelector('.scenario-card')).toBeNull();

    await harness.navigateByUrl(LIST_URL);
    await harness.navigateByUrl(`${LIST_URL}/new`);
    expect(host(harness).querySelectorAll('.scenario-card')).toHaveLength(4);
    expect(answerFields(harness)).toHaveLength(0);
  });

  it('lists long views newest first by scenario, date and value count', async () => {
    const harness = await setUp();
    seed(
      completeView('old', 'funeral', ['family'], '2026-09-01'),
      completeView('new', 'lastDay', ['craft', 'team'], '2026-09-20'),
    );
    harness.detectChanges();

    const titles = [...host(harness).querySelectorAll('.assessment-history-list__item')].map(
      (row) => row.querySelector('[matListItemTitle]')?.textContent?.trim(),
    );
    expect(titles).toEqual(['Your last day at work', 'Your funeral']);
    expect(host(harness).querySelector('.assessment-history-list__summary')?.textContent).toContain(
      '2 values',
    );
  });

  it('re-translates history rows on a language switch', async () => {
    const harness = await setUp();
    seed(completeView('lv1', 'funeral', ['family']));
    harness.detectChanges();
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(
      host(harness).querySelector('.assessment-history-list__item [matListItemTitle]')?.textContent,
    ).toContain('جنازتك');
  });

  it('summarises values heard with counts and complete scenarios, only once one exists', async () => {
    const harness = await setUp();
    expect(host(harness).querySelector('app-long-view-summary')).toBeNull();

    seed(
      completeView('a', 'funeral', ['Family', 'time']),
      completeView('b', 'oneYear', ['family']),
    );
    harness.detectChanges();

    const summary = host(harness).querySelector('app-long-view-summary') as HTMLElement;
    const chips = [...summary.querySelectorAll('mat-chip')].map((chip) => chip.textContent?.trim());
    expect(chips).toEqual(['Family · 2', 'time']);
    expect(summary.textContent).toContain('2 of 4 long views');
  });

  it('enables Mark done once one long view is complete', async () => {
    const harness = await setUp();
    const button = () => host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(host(harness).querySelector('app-done-toggle .done-checklist')?.textContent).toContain(
      'Pick a long view',
    );

    seed(completeView('a', 'lastDay', ['craft']));
    harness.detectChanges();
    expect(button().getAttribute('aria-disabled')).not.toBe('true');
  });
});
