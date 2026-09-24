import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import {
  MATURITY_MODEL_KEY,
  MATURITY_ROUTE,
  MaturityAssessment,
  registerMaturityModel,
} from './maturity.model';
import maturityRoutes from './maturity.routes';

/** The editable date and the "date + summary" history (issue #226), apart from
 * `maturity-page.spec.ts` (which is near the 500-line limit). */
const LIST_URL = `/${MATURITY_ROUTE}`;

async function setUp(): Promise<RouterTestingHarness> {
  registerExerciseKitModel();
  registerMaturityModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(
        [{ path: MATURITY_ROUTE, children: maturityRoutes }],
        withComponentInputBinding(),
      ),
      { provide: CLOCK, useValue: { now: () => new Date('2026-01-01T00:00:00.000Z') } },
      { provide: WRITER_LOCK, useValue: { role: signal('writer'), isWriter: signal(true) } },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

function dateInput(harness: RouterTestingHarness): HTMLInputElement {
  return host(harness).querySelector('app-assessment-date-field input') as HTMLInputElement;
}

function typeDate(harness: RouterTestingHarness, value: string): void {
  const input = dateInput(harness);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  harness.detectChanges();
}

function storedAssessments(): readonly MaturityAssessment[] {
  return TestBed.runInInjectionContext(() =>
    featureStore<MaturityAssessment[]>(MATURITY_MODEL_KEY).value(),
  );
}

function seed(...records: MaturityAssessment[]): void {
  TestBed.runInInjectionContext(() =>
    featureStore<MaturityAssessment[]>(MATURITY_MODEL_KEY).update((current) => [
      ...current,
      ...records,
    ]),
  );
}

function rated(date: string, levels: readonly (1 | 2 | 3)[]): MaturityAssessment {
  return newRecord(
    {
      date,
      areas: levels.map((level, index) => ({ id: `${date}-${index}`, key: 'work', level })),
    },
    new Date(`${date}T12:00:00.000Z`),
  );
}

describe('MaturityPage editable date (issue #226)', () => {
  it('a date change alone keeps the draft in memory; Continue stores it with that date', async () => {
    const harness = await setUp();
    const before = TestBed.inject(DocumentStore).document();
    (host(harness).querySelector('.add-button') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(dateInput(harness).value).toBe('2026-01-01');

    typeDate(harness, '2025-12-24');
    expect(TestBed.inject(DocumentStore).document()).toBe(before);

    (host(harness).querySelectorAll('.area-chip')[0] as HTMLButtonElement).click();
    harness.detectChanges();
    (host(harness).querySelector('.continue-button') as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    expect(storedAssessments().map((assessment) => assessment.date)).toEqual(['2025-12-24']);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/${storedAssessments()[0].id}`);
  });

  it('stores a date edit on a saved assessment and re-sorts the history by it', async () => {
    const harness = await setUp();
    const older = rated('2025-10-01', [1, 1]);
    const newer = rated('2025-11-01', [2, 2, 1]);
    seed(older, newer);
    await harness.navigateByUrl(`${LIST_URL}/${older.id}`);
    await harness.fixture.whenStable();

    typeDate(harness, '2025-12-01');
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(storedAssessments().find((a) => a.id === older.id)?.date).toBe('2025-12-01');
    const rows = [...host(harness).querySelectorAll('.assessment-history-list__item')];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Mostly dependence'),
      expect.stringContaining('Mostly independence'),
    ]);
  });

  it('a refused date edit (read-only tab) shows the stored date again', async () => {
    const harness = await setUp();
    const record = rated('2025-10-01', [2]);
    seed(record);
    await harness.navigateByUrl(`${LIST_URL}/${record.id}`);
    await harness.fixture.whenStable();
    (TestBed.inject(WRITER_LOCK).isWriter as ReturnType<typeof signal<boolean>>).set(false);

    typeDate(harness, '2025-12-01');
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(storedAssessments()[0].date).toBe('2025-10-01');
    expect(dateInput(harness).value).toBe('2025-10-01');
  });
});
