import { Location } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { WRITER_LOCK } from '../../core/data/multi-tab/writer-lock';
import { WriterRole } from '../../core/data/multi-tab/writer-role-state';
import { CLOCK } from '../../core/time/clock';
import '../../features/settings/settings.model';
import { registerExerciseKitModel } from '../../shared/exercise-kit/exercise-kit.model';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import {
  PC_BALANCE_MODEL_KEY,
  PC_BALANCE_ROUTE,
  PcAudit,
  registerPcBalanceModel,
} from './pc-balance.model';
import pcBalanceRoutes from './pc-balance.routes';

/** The draft-before-record edge cases (issue #217's review findings), apart from
 * `pc-balance-page.spec.ts`: a debounced reflection flushed by closing, and a read-only tab. */
const LIST_URL = `/${PC_BALANCE_ROUTE}`;
const ELSEWHERE_URL = '/elsewhere';

@Component({ template: '' })
class Elsewhere {}

async function setUp(role: WriterRole = 'writer'): Promise<RouterTestingHarness> {
  registerExerciseKitModel();
  registerPcBalanceModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(
        [
          { path: PC_BALANCE_ROUTE, children: pcBalanceRoutes },
          { path: ELSEWHERE_URL.slice(1), component: Elsewhere },
        ],
        withComponentInputBinding(),
      ),
      { provide: CLOCK, useValue: { now: () => new Date('2026-01-01T00:00:00.000Z') } },
      {
        provide: WRITER_LOCK,
        useValue: { role: signal(role), isWriter: signal(role === 'writer') },
      },
    ],
  });
  return RouterTestingHarness.create(LIST_URL);
}

function host(harness: RouterTestingHarness): HTMLElement {
  return harness.routeNativeElement as HTMLElement;
}

async function click(harness: RouterTestingHarness, selector: string): Promise<void> {
  (host(harness).querySelector(selector) as HTMLButtonElement).click();
  await harness.fixture.whenStable();
  harness.detectChanges();
}

/** Types into the reflection's textarea, well inside `ReflectionEditor`'s 1 s debounce. */
function typeReflection(harness: RouterTestingHarness, text: string): void {
  const textarea = host(harness).querySelector(
    'app-reflection-editor textarea',
  ) as HTMLTextAreaElement;
  textarea.value = text;
  textarea.dispatchEvent(new Event('input'));
  harness.detectChanges();
}

/** The whole document: the same object while no edit has been applied since it was read. */
function currentDocument(): unknown {
  return TestBed.inject(DocumentStore).document();
}

function storedAudits(): readonly PcAudit[] {
  return TestBed.runInInjectionContext(() => featureStore<PcAudit[]>(PC_BALANCE_MODEL_KEY).value());
}

describe('PcBalancePage draft (issue #217)', () => {
  it('saves a reflection flushed by Done inside the debounce, and stays closed', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');
    typeReflection(harness, 'Rested more this month');

    await click(harness, '.editor-done');

    const audits = storedAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0].reflection).toBe('Rested more this month');
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(host(harness).querySelector('app-pc-balance-audit-form')).toBeNull();
  });

  it('writes nothing when a whitespace-only reflection is flushed by closing', async () => {
    const harness = await setUp();
    const before = currentDocument();
    await click(harness, '.add-button');
    typeReflection(harness, '   ');

    await click(harness, '.editor-done');

    expect(currentDocument()).toBe(before);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
  });

  it('shows no "Saved" for a whitespace-only reflection kept in the draft', async () => {
    const harness = await setUp();
    const before = currentDocument();
    await click(harness, '.add-button');
    vi.useFakeTimers();
    try {
      typeReflection(harness, '   ');
      vi.advanceTimersByTime(1000);
      harness.detectChanges();
    } finally {
      vi.useRealTimers();
    }

    expect(host(harness).querySelector('app-reflection-editor')?.textContent).not.toContain(
      'Saved',
    );
    expect(currentDocument()).toBe(before);
  });

  it('saves a typed reflection at once, so leaving the page stays left (R1)', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');
    typeReflection(harness, 'Rested more this month');

    await harness.navigateByUrl(ELSEWHERE_URL);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(ELSEWHERE_URL);
    expect(storedAudits().map((audit) => audit.reflection)).toEqual(['Rested more this month']);
  });

  it('keeps the typed reflection when New is pressed again at once (R2)', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');
    typeReflection(harness, 'Rested more this month');

    await click(harness, '.add-button');

    expect(storedAudits().map((audit) => audit.reflection)).toEqual(['Rested more this month']);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);
    const textarea = host(harness).querySelector(
      'app-reflection-editor textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('leaves no `new` entry behind Done for Back to reopen as a blank draft (R10)', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');
    typeReflection(harness, 'Rested more this month');
    // Well inside the 1 s debounce, but after the router has settled, as a user's next tap is.
    await harness.fixture.whenStable();
    await click(harness, '.editor-done');

    // The history entry Back lands on; this harness' router doesn't follow popstate itself.
    const location = TestBed.inject(Location);
    location.back();

    const [audit] = storedAudits();
    expect(location.path()).toBe(`${LIST_URL}/${audit.id}`);
    expect(storedAudits()).toHaveLength(1);
  });

  it('opens no draft in a read-only tab, and counts it as a refused edit', async () => {
    const harness = await setUp('reader');
    await click(harness, '.add-button');

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(host(harness).querySelector('app-pc-balance-audit-form')).toBeNull();
    expect(TestBed.inject(DocumentStore).refusedEdits()).toBe(1);
  });
});

describe('PcBalancePage editable date (issue #226)', () => {
  function dateInput(harness: RouterTestingHarness): HTMLInputElement {
    return host(harness).querySelector('app-assessment-date-field input') as HTMLInputElement;
  }

  function typeDate(harness: RouterTestingHarness, value: string): void {
    const input = dateInput(harness);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    // Committed when the user leaves the field (issue #226 review).
    input.dispatchEvent(new Event('blur'));
    harness.detectChanges();
  }

  it('defaults a new audit to today', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');

    expect(dateInput(harness).value).toBe('2026-01-01');
  });

  it('keeps a date change alone in the draft, and stores it with the first real input', async () => {
    const harness = await setUp();
    const before = currentDocument();
    await click(harness, '.add-button');

    typeDate(harness, '2025-12-20');
    expect(currentDocument()).toBe(before);
    expect(TestBed.inject(Router).url).toBe(`${LIST_URL}/new`);

    typeReflection(harness, 'Rested more this month');
    expect(storedAudits().map((audit) => audit.date)).toEqual(['2025-12-20']);
  });

  it('stores a date edit on a saved audit, and never a cleared one', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');
    typeReflection(harness, 'Rested more this month');
    await harness.fixture.whenStable();

    typeDate(harness, '2025-11-02');
    expect(storedAudits()[0].date).toBe('2025-11-02');

    typeDate(harness, '');
    dateInput(harness).dispatchEvent(new Event('blur'));
    expect(storedAudits()[0].date).toBe('2025-11-02');
    expect(dateInput(harness).value).toBe('2025-11-02');
  });

  it('shows the stored date again when a read-only tab refuses the edit', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');
    typeReflection(harness, 'Rested more this month');
    await harness.fixture.whenStable();
    const lock = TestBed.inject(WRITER_LOCK) as unknown as {
      role: ReturnType<typeof signal<WriterRole>>;
      isWriter: ReturnType<typeof signal<boolean>>;
    };
    lock.role.set('reader');
    lock.isWriter.set(false);

    typeDate(harness, '2025-11-02');
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(storedAudits()[0].date).toBe('2026-01-01');
    expect(dateInput(harness).value).toBe('2026-01-01');
  });

  /** Safari/iOS: a tapped button isn't focused, so Done removes the still-focused date input
   * without a blur. The date is typed (`input`/`change` while focused) but never left. */
  function typeDateWithoutLeaving(harness: RouterTestingHarness, value: string): void {
    const input = dateInput(harness);
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    harness.detectChanges();
  }

  it('stores a date still in the field when Done closes a saved audit', async () => {
    const harness = await setUp();
    await click(harness, '.add-button');
    typeReflection(harness, 'Rested more this month');
    await harness.fixture.whenStable();
    const id = storedAudits()[0].id;

    typeDateWithoutLeaving(harness, '2025-11-02');
    expect(storedAudits()[0].date).toBe('2026-01-01');
    await click(harness, '.editor-done');

    expect(storedAudits().map((audit) => [audit.id, audit.date])).toEqual([[id, '2025-11-02']]);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(host(harness).querySelector('app-pc-balance-audit-form')).toBeNull();
  });

  it('stores nothing when Done closes a new draft with only its date changed', async () => {
    const harness = await setUp();
    const before = currentDocument();
    await click(harness, '.add-button');

    typeDateWithoutLeaving(harness, '2025-11-02');
    await click(harness, '.editor-done');

    expect(currentDocument()).toBe(before);
    expect(TestBed.inject(Router).url).toBe(LIST_URL);
  });
});
