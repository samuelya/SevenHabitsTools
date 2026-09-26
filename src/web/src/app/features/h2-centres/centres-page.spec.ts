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
import { newAssessmentFields } from './centres.logic';
import {
  CENTRES_MODEL_KEY,
  CENTRES_ROUTE,
  CentreAssessment,
  registerCentresModel,
} from './centres.model';
import centresRoutes from './centres.routes';

const LIST_URL = `/${CENTRES_ROUTE}`;
const NOW = '2026-09-26T09:00:00.000Z';

function testRoutes(): Routes {
  return [{ path: CENTRES_ROUTE, children: centresRoutes }];
}

async function setUp(): Promise<RouterTestingHarness> {
  // Vitest here runs with `isolate: false` (shared module state) — see `exercise-kit.model.spec.ts`.
  registerExerciseKitModel();
  registerCentresModel();
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

function stored(): readonly CentreAssessment[] {
  return TestBed.runInInjectionContext(() =>
    featureStore<CentreAssessment[]>(CENTRES_MODEL_KEY).value(),
  );
}

function seed(...assessments: CentreAssessment[]): void {
  TestBed.runInInjectionContext(() =>
    featureStore<CentreAssessment[]>(CENTRES_MODEL_KEY).update((current) => [
      ...current,
      ...assessments,
    ]),
  );
}

function assessment(
  id: string,
  fields: Partial<CentreAssessment> = {},
  date = '2026-09-20',
): CentreAssessment {
  return {
    id,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    ...newAssessmentFields(date),
    ...fields,
  };
}

const COMPLETE_FIELDS: Partial<CentreAssessment> = {
  ratings: { work: 3, money: 2 },
  factors: { security: 'a', guidance: 'b', wisdom: 'c', power: 'd' },
  principles: [{ key: 'integrity' }, { name: 'keeping my word' }],
};

async function click(harness: RouterTestingHarness, element: Element | null): Promise<void> {
  (element as HTMLElement).click();
  await harness.fixture.whenStable();
}

async function openNew(harness: RouterTestingHarness): Promise<void> {
  await click(harness, host(harness).querySelector('.add-button'));
}

/** The `index`th rating toggle of the `card`th centre card. */
function toggle(harness: RouterTestingHarness, card: number, index: number): Element {
  const cards = host(harness).querySelectorAll('app-centre-card');
  return cards[card].querySelectorAll('.mat-button-toggle-button')[index];
}

describe('CentresPage (issue #60)', () => {
  it('renders the long title and the gloss', async () => {
    const harness = await setUp();
    expect(host(harness).textContent).toContain('Find what your life revolves around');
    expect(host(harness).querySelector('.prompt-gloss')?.textContent).toContain(
      'principle-centred',
    );
  });

  it('New assessment opens ten centre cards at `new` and stores nothing', async () => {
    const harness = await setUp();
    await openNew(harness);

    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    const titles = [...host(harness).querySelectorAll('app-centre-card .centre-title')].map(
      (title) => title.textContent?.trim(),
    );
    expect(titles).toHaveLength(10);
    expect(titles[0]).toBe('Partner');
    expect(titles[9]).toBe('Yourself');
    const group = host(harness).querySelector('app-centre-card mat-button-toggle-group');
    expect(group?.getAttribute('aria-labelledby')).toBe('centre-partner-title');
    expect(stored()).toHaveLength(0);
  });

  it('stores the record on the first rating and stays in the editor', async () => {
    const harness = await setUp();
    await openNew(harness);
    await click(harness, toggle(harness, 3, 3));

    const list = stored();
    expect(list).toHaveLength(1);
    expect(list[0].ratings).toEqual({ work: 3 });
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${list[0].id}`);
    expect(host(harness).querySelector('app-guided-stepper')).not.toBeNull();
  });

  it('names the top centre in step 2, or shows the note when nothing is rated above 0', async () => {
    const harness = await setUp();
    await openNew(harness);
    await click(harness, toggle(harness, 0, 0));
    const factors = () => host(harness).querySelector('app-centres-factors') as HTMLElement;
    expect(factors().querySelector('.none-text')).not.toBeNull();
    expect(factors().querySelectorAll('textarea')).toHaveLength(0);

    await click(harness, toggle(harness, 2, 2));
    expect(factors().textContent).toContain("Right now it's Money.");
    const fields = factors().querySelectorAll('textarea');
    expect(fields).toHaveLength(4);
    expect(fields[0].placeholder).toBe(
      'e.g. Sure of myself after a good review. Nothing after a bad one.',
    );

    fields[0].value = 'Sure of myself.';
    fields[0].dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(stored()[0].factors).toEqual({ security: 'Sure of myself.' });
  });

  it('Save shows the ranked result; Edit goes back to the stepper', async () => {
    const harness = await setUp();
    seed(assessment('c1', COMPLETE_FIELDS));
    await harness.navigateByUrl(`${LIST_URL}/c1`);

    const result = () => host(harness).querySelector('app-centres-result') as HTMLElement | null;
    expect(result()).not.toBeNull();
    const bars = [...result()!.querySelectorAll('.bar-track')].map((bar) =>
      bar.getAttribute('aria-label'),
    );
    expect(bars.slice(0, 3)).toEqual(['Work: 3 of 3', 'Money: 2 of 3', 'Partner: 0 of 3']);
    expect(result()!.textContent).toContain('Your top centre: Work');
    const chips = [...result()!.querySelectorAll('mat-chip')].map((chip) =>
      chip.textContent?.trim(),
    );
    expect(chips).toEqual(['Integrity', 'keeping my word']);
    expect(result()!.textContent).not.toContain('Since last time');

    await click(harness, result()!.querySelector('.actions button'));
    expect(result()).toBeNull();
    expect(host(harness).querySelector('app-guided-stepper')).not.toBeNull();

    await click(harness, host(harness).querySelector('.save-button'));
    expect(result()).not.toBeNull();
  });

  it('Save on an untouched draft closes it and stores nothing', async () => {
    const harness = await setUp();
    await openNew(harness);
    await click(harness, host(harness).querySelector('.save-button'));
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(stored()).toHaveLength(0);
  });

  it('shows what changed since the previous assessment', async () => {
    const harness = await setUp();
    seed(
      assessment('old', { ratings: { work: 3, money: 2 } }, '2026-06-01'),
      assessment('mid', { ratings: { work: 2, money: 2 } }, '2026-09-20'),
      assessment('same', { ratings: { work: 2, money: 2 } }, '2026-09-25'),
    );
    await harness.navigateByUrl(`${LIST_URL}/mid`);
    const result = host(harness).querySelector('app-centres-result') as HTMLElement;
    expect(result.textContent).toContain('Since last time');
    expect(result.textContent).toContain('Work 3 → 2');

    await harness.navigateByUrl(`${LIST_URL}/same`);
    expect(host(harness).querySelector('app-centres-result')?.textContent).toContain(
      'Same ratings as last time.',
    );
  });

  it('lists assessments newest first by top centre and principle count, re-translated on a language switch', async () => {
    const harness = await setUp();
    seed(
      assessment('a', { ratings: { money: 1 } }, '2026-08-01'),
      assessment('b', COMPLETE_FIELDS, '2026-09-20'),
    );
    harness.detectChanges();
    await harness.fixture.whenStable();

    const titles = () =>
      [...host(harness).querySelectorAll('.assessment-history-list__item [matListItemTitle]')].map(
        (title) => title.textContent?.trim(),
      );
    expect(titles()).toEqual(['Centre: Work', 'Centre: Money']);
    expect(host(harness).querySelector('.assessment-history-list__summary')?.textContent).toContain(
      '2 principles',
    );

    TestBed.inject(TranslocoService).setActiveLang('ar');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(titles()[0]).toBe('المركز: العمل');
  });

  it('refuses a sixth principle with the hint and keeps the five', async () => {
    const harness = await setUp();
    seed(
      assessment('c1', {
        ratings: { work: 1 },
        principles: [
          { key: 'fairness' },
          { key: 'honesty' },
          { key: 'integrity' },
          { key: 'dignity' },
          { name: 'x' },
        ],
      }),
    );
    await harness.navigateByUrl(`${LIST_URL}/c1`);
    await click(harness, host(harness).querySelector('app-centres-result .actions button'));

    const options = host(harness).querySelectorAll('app-centres-principles mat-chip-option');
    await click(harness, options[4].querySelector('.mdc-evolution-chip__action--primary'));

    expect(stored()[0].principles).toHaveLength(5);
    expect(host(harness).querySelector('.max-hint')?.textContent).toContain(
      'Five is enough to live by.',
    );
    expect(options[4].querySelector('[aria-selected="true"]')).toBeNull();

    await click(harness, options[0].querySelector('.mdc-evolution-chip__action--primary'));
    expect(stored()[0].principles.some((principle) => principle.key === 'fairness')).toBe(false);
    expect(host(harness).querySelector('.max-hint')?.textContent?.trim()).toBe('');
  });

  it('enables Mark done once one assessment is complete', async () => {
    const harness = await setUp();
    const markDone = () =>
      host(harness).querySelector('app-done-toggle button') as HTMLButtonElement;
    expect(markDone().getAttribute('aria-disabled')).toBe('true');

    seed(assessment('c1', COMPLETE_FIELDS));
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(markDone().getAttribute('aria-disabled')).not.toBe('true');
  });
});
