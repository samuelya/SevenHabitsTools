import { signal } from '@angular/core';
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

async function setUp(role: WriterRole = 'writer'): Promise<RouterTestingHarness> {
  registerExerciseKitModel();
  registerPcBalanceModel();
  TestBed.configureTestingModule({
    providers: [
      provideTranslocoTesting(),
      provideRouter(
        [{ path: PC_BALANCE_ROUTE, children: pcBalanceRoutes }],
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

/** Types into the reflection's textarea: `ReflectionEditor` holds it for its 1 s debounce. */
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

  it('reports "Saved" for a whitespace-only reflection kept in the draft', async () => {
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

    expect(host(harness).querySelector('app-reflection-editor')?.textContent).toContain('Saved');
    expect(currentDocument()).toBe(before);
  });

  it('opens no draft in a read-only tab, and counts it as a refused edit', async () => {
    const harness = await setUp('reader');
    await click(harness, '.add-button');

    expect(TestBed.inject(Router).url).toBe(LIST_URL);
    expect(host(harness).querySelector('app-pc-balance-audit-form')).toBeNull();
    expect(TestBed.inject(DocumentStore).refusedEdits()).toBe(1);
  });
});
